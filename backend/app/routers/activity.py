"""Activity feed + message posting endpoints."""

from __future__ import annotations

import time
import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..config import settings, log
from ..data import read_table, write_table
from ..events import event_bus, Event

router = APIRouter(tags=["activity"])


def _now_ms() -> int:
    return int(time.time() * 1000)


# ── Activity feed ────────────────────────────────────────────────────────────

@router.get("/activity")
def list_activity(limit: int = 100) -> list[dict[str, Any]]:
    rows = read_table(settings.mc_root, "activities.json")
    rows.sort(key=lambda r: r.get("createdAtMs", 0), reverse=True)
    return rows[:limit]


# ── Messages ─────────────────────────────────────────────────────────────────

class MessageCreate(BaseModel):
    taskId: str | None = None
    fromAgentId: str | None = None
    content: str = Field(min_length=1, max_length=8000)


@router.get("/messages")
def list_messages(task_id: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
    rows = read_table(settings.mc_root, "messages.json")
    if task_id:
        rows = [r for r in rows if r.get("taskId") == task_id]
    rows.sort(key=lambda r: r.get("createdAtMs", 0), reverse=True)
    return rows[:limit]


@router.post("/messages", status_code=201)
def create_message(payload: MessageCreate) -> dict[str, Any]:
    rows = read_table(settings.mc_root, "messages.json")
    msg: dict[str, Any] = {
        "id": f"msg_{uuid.uuid4().hex[:10]}",
        "taskId": payload.taskId,
        "fromAgentId": payload.fromAgentId,
        "content": payload.content,
        "createdAtMs": _now_ms(),
    }
    rows.append(msg)
    rows = rows[-1000:]
    write_table(settings.mc_root, "messages.json", rows)

    # Record activity
    activities = read_table(settings.mc_root, "activities.json")
    activities.append({
        "id": f"evt_{uuid.uuid4().hex[:10]}",
        "type": "message.sent",
        "message": payload.content[:200],
        "taskId": payload.taskId,
        "agentId": payload.fromAgentId,
        "createdAtMs": _now_ms(),
    })
    activities = activities[-500:]
    write_table(settings.mc_root, "activities.json", activities)

    log.info("Message posted by %s on task %s", payload.fromAgentId, payload.taskId)
    return msg

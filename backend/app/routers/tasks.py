"""Task CRUD endpoints with event publishing."""

from __future__ import annotations

import asyncio
import time
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..config import settings, log
from ..data import read_table, write_table
from ..events import event_bus, Event

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _now_ms() -> int:
    return int(time.time() * 1000)


def _make_id() -> str:
    return f"task_{uuid.uuid4().hex[:12]}"


# ── Schemas ──────────────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=8000)
    status: str = "inbox"
    assigneeIds: list[str] = Field(default_factory=list)
    priority: str | None = None
    deadline: str | None = None


class TaskPatch(BaseModel):
    title: str | None = Field(default=None, max_length=300)
    description: str | None = Field(default=None, max_length=8000)
    status: str | None = None
    assigneeIds: list[str] | None = None
    priority: str | None = None
    deadline: str | None = None


# ── Helpers ──────────────────────────────────────────────────────────────────

def _record_activity(entry: dict[str, Any]) -> None:
    from ..data import read_table as _rt, write_table as _wt

    rows = _rt(settings.mc_root, "activities.json")
    entry.setdefault("id", f"evt_{uuid.uuid4().hex[:10]}")
    entry.setdefault("createdAtMs", _now_ms())
    rows.append(entry)
    rows = rows[-500:]
    _wt(settings.mc_root, "activities.json", rows)


def _emit(event_type: str, data: dict[str, Any]) -> None:
    """Fire-and-forget publish to SSE bus."""
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(event_bus.publish(Event(type=event_type, data=data)))
    except RuntimeError:
        pass  # no event loop (e.g. during tests)


async def _auto_dispatch(task: dict[str, Any]) -> None:
    """Auto-dispatch task to assigned agents if enabled."""
    if not settings.auto_dispatch or not settings.gateway_token:
        return
    assignees = task.get("assigneeIds") or []
    if not assignees:
        return
    try:
        from ..services.dispatcher import dispatch_task
        await dispatch_task(task)
    except Exception as e:
        log.error("auto_dispatch failed task=%s: %s", task.get("id"), e)


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("")
def list_tasks() -> list[dict[str, Any]]:
    return read_table(settings.mc_root, "tasks.json")


@router.post("", status_code=201)
async def create_task(payload: TaskCreate) -> dict[str, Any]:
    tasks = read_table(settings.mc_root, "tasks.json")
    task: dict[str, Any] = {
        "id": _make_id(),
        "title": payload.title,
        "description": payload.description,
        "status": payload.status,
        "assigneeIds": payload.assigneeIds,
        "priority": payload.priority,
        "deadline": payload.deadline,
        "createdAtMs": _now_ms(),
    }
    tasks.append(task)
    write_table(settings.mc_root, "tasks.json", tasks)
    log.info("Task created: %s — %s", task["id"], task["title"])

    _record_activity({
        "type": "task.created",
        "message": f"Task created: {task['title']}",
        "taskId": task["id"],
    })
    _emit("task.created", task)

    # Auto-dispatch to assigned agents
    await _auto_dispatch(task)

    return task


@router.patch("/{task_id}")
async def update_task(task_id: str, payload: TaskPatch) -> dict[str, Any]:
    tasks = read_table(settings.mc_root, "tasks.json")
    for t in tasks:
        if t.get("id") == task_id:
            changes = payload.model_dump(exclude_unset=True)
            old_status = t.get("status")
            old_assignees = set(t.get("assigneeIds") or [])
            for k, v in changes.items():
                t[k] = v
            t["updatedAtMs"] = _now_ms()
            write_table(settings.mc_root, "tasks.json", tasks)

            msg_parts = []
            if "status" in changes and changes["status"] != old_status:
                msg_parts.append(f"status → {changes['status']}")
            if "assigneeIds" in changes:
                msg_parts.append(f"assigned → {changes['assigneeIds']}")
            if "title" in changes:
                msg_parts.append(f"title → {changes['title']}")

            _record_activity({
                "type": "task.updated",
                "message": f"Task updated: {', '.join(msg_parts) or task_id}",
                "taskId": task_id,
            })
            _emit("task.updated", t)
            log.info("Task updated: %s — %s", task_id, msg_parts)

            # Auto-dispatch if new agents were assigned
            new_assignees = set(t.get("assigneeIds") or [])
            if "assigneeIds" in changes and new_assignees - old_assignees:
                await _auto_dispatch(t)

            return t

    raise HTTPException(status_code=404, detail="Task not found")


@router.delete("/{task_id}")
def delete_task(task_id: str) -> dict[str, str]:
    tasks = read_table(settings.mc_root, "tasks.json")
    before = len(tasks)
    tasks = [t for t in tasks if t.get("id") != task_id]
    if len(tasks) == before:
        raise HTTPException(status_code=404, detail="Task not found")
    write_table(settings.mc_root, "tasks.json", tasks)
    _record_activity({
        "type": "task.deleted",
        "message": f"Task deleted: {task_id}",
        "taskId": task_id,
    })
    _emit("task.deleted", {"id": task_id})
    log.info("Task deleted: %s", task_id)
    return {"ok": "deleted"}

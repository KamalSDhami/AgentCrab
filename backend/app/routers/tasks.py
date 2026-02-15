"""Task CRUD endpoints with state machine, result storage, audit log."""

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


class TaskResultCreate(BaseModel):
    content: str = Field(default="", max_length=50000)
    summary: str = Field(default="", max_length=2000)
    files: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    execution_log: str = Field(default="", max_length=20000)


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
        pass


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


def _record_edit_audit(task_id: str, changes: dict[str, Any], before: dict[str, Any]) -> None:
    """Record an audit entry for task edits with version tracking."""
    tasks = read_table(settings.mc_root, "tasks.json")
    for t in tasks:
        if t.get("id") == task_id:
            if "editHistory" not in t:
                t["editHistory"] = []
            t["editHistory"].append({
                "changes": changes,
                "before": {k: before.get(k) for k in changes},
                "atMs": _now_ms(),
                "version": len(t["editHistory"]) + 1,
            })
            t["editHistory"] = t["editHistory"][-30:]  # keep last 30
            break
    write_table(settings.mc_root, "tasks.json", tasks)


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
        "stateHistory": [{"from": None, "to": payload.status, "actor": "user", "reason": "created", "atMs": _now_ms()}],
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

            # Save before-state for audit
            before_state = {k: t.get(k) for k in changes}

            # State machine validation
            if "status" in changes and changes["status"] != old_status:
                from ..services.supervisor import validate_transition
                if not validate_transition(old_status or "inbox", changes["status"]):
                    log.warning(
                        "task.invalid_transition task=%s from=%s to=%s (allowing)",
                        task_id, old_status, changes["status"],
                    )
                # Record state transition
                from ..services.supervisor import record_state_transition
                record_state_transition(
                    task_id, old_status or "inbox", changes["status"],
                    actor="user", reason="manual update",
                )

            for k, v in changes.items():
                t[k] = v
            t["updatedAtMs"] = _now_ms()
            write_table(settings.mc_root, "tasks.json", tasks)

            # Record edit audit
            _record_edit_audit(task_id, changes, before_state)

            msg_parts = []
            if "status" in changes and changes["status"] != old_status:
                msg_parts.append(f"status → {changes['status']}")
            if "assigneeIds" in changes:
                msg_parts.append(f"assigned → {changes['assigneeIds']}")
            if "title" in changes:
                msg_parts.append(f"title → {changes['title']}")
            if "description" in changes:
                msg_parts.append("description updated")
            if "priority" in changes:
                msg_parts.append(f"priority → {changes['priority']}")

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


# ── Task Result Endpoints ────────────────────────────────────────────────────

@router.get("/{task_id}/result")
def get_task_result(task_id: str) -> dict[str, Any]:
    """Get the stored result for a completed task."""
    tasks = read_table(settings.mc_root, "tasks.json")
    task = next((t for t in tasks if t.get("id") == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    result = task.get("result")
    if not result:
        raise HTTPException(status_code=404, detail="No result stored for this task")
    return {"taskId": task_id, "result": result}


@router.post("/{task_id}/result", status_code=201)
def store_task_result(task_id: str, payload: TaskResultCreate) -> dict[str, Any]:
    """Store or update the result for a task."""
    from ..services.supervisor import store_task_result as _store

    try:
        result = _store(
            task_id,
            content=payload.content,
            summary=payload.summary,
            files=payload.files,
            metadata=payload.metadata,
            execution_log=payload.execution_log,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    _record_activity({
        "type": "task.result_stored",
        "message": f"Result stored for task {task_id}",
        "taskId": task_id,
    })
    _emit("task.result_stored", {"taskId": task_id, "result": result})
    return {"ok": True, "taskId": task_id, "result": result}


# ── Task State History & Edit Audit ──────────────────────────────────────────

@router.get("/{task_id}/history")
def get_task_history(task_id: str) -> dict[str, Any]:
    """Get state transitions and edit audit for a task."""
    tasks = read_table(settings.mc_root, "tasks.json")
    task = next((t for t in tasks if t.get("id") == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return {
        "taskId": task_id,
        "stateHistory": task.get("stateHistory", []),
        "editHistory": task.get("editHistory", []),
        "delegation": task.get("delegation"),
    }


# ── Supervisor Endpoints ────────────────────────────────────────────────────

@router.get("/{task_id}/delegations")
def get_task_delegations(task_id: str) -> list[dict[str, Any]]:
    """Get delegation records for a task."""
    from ..services.supervisor import get_delegations_for_task
    return get_delegations_for_task(task_id)


@router.get("/{task_id}/capabilities")
def get_capability_match(task_id: str) -> dict[str, Any]:
    """Get capability matching suggestion for a task."""
    from ..services.supervisor import match_agent_for_task, AGENT_CAPABILITIES

    tasks = read_table(settings.mc_root, "tasks.json")
    task = next((t for t in tasks if t.get("id") == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    suggested = match_agent_for_task(task)
    return {
        "taskId": task_id,
        "suggestedAgent": suggested,
        "capabilities": AGENT_CAPABILITIES,
    }

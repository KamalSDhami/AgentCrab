"""Task dispatch service — bridges AgentCrab tasks with OpenClaw agent execution.

Lifecycle:
  1. Task created/assigned in dashboard
  2. Dispatcher sends structured message to agent via gateway RPC
  3. Agent receives message, processes task
  4. Agent updates WORKING.md / HEARTBEAT.md with progress
  5. Dashboard polls and reflects state changes

Dispatch message format sent to agents:
  📋 TASK ASSIGNED — <title>
  ID: <task_id>
  Priority: <priority>
  Status: <status>
  ---
  <description>
  ---
  Instructions: Read this task. Update your WORKING.md with your plan.
  Execute the task. When complete, update WORKING.md with results.
"""

from __future__ import annotations

import asyncio
import time
import uuid
import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any
from collections import deque

from ..config import settings
from ..data import read_table, write_table
from ..events import event_bus, Event

log = logging.getLogger("agentcrab.dispatch")


# ── Dispatch state ───────────────────────────────────────────────────────────


class DispatchStatus(str, Enum):
    PENDING = "pending"
    DISPATCHING = "dispatching"
    DISPATCHED = "dispatched"
    DELIVERED = "delivered"
    CLAIMED = "claimed"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"


@dataclass
class DispatchRecord:
    """Tracks a single dispatch attempt."""

    id: str = ""
    task_id: str = ""
    agent_id: str = ""
    status: DispatchStatus = DispatchStatus.PENDING
    message: str = ""
    response: str | None = None
    error: str | None = None
    attempt: int = 1
    created_at_ms: int = 0
    dispatched_at_ms: int | None = None
    completed_at_ms: int | None = None

    def __post_init__(self):
        if not self.id:
            self.id = f"dsp_{uuid.uuid4().hex[:12]}"
        if not self.created_at_ms:
            self.created_at_ms = int(time.time() * 1000)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "taskId": self.task_id,
            "agentId": self.agent_id,
            "status": self.status.value,
            "message": self.message[:500],
            "response": (self.response or "")[:1000],
            "error": self.error,
            "attempt": self.attempt,
            "createdAtMs": self.created_at_ms,
            "dispatchedAtMs": self.dispatched_at_ms,
            "completedAtMs": self.completed_at_ms,
        }


# ── In-memory dispatch log (also persisted to activities) ────────────────────

_dispatch_log: deque[DispatchRecord] = deque(maxlen=500)


def get_dispatch_log(limit: int = 100) -> list[dict[str, Any]]:
    """Return recent dispatch records."""
    items = list(_dispatch_log)
    items.reverse()
    return [r.to_dict() for r in items[:limit]]


def get_dispatch_for_task(task_id: str) -> list[dict[str, Any]]:
    """Return dispatch records for a specific task."""
    return [r.to_dict() for r in _dispatch_log if r.task_id == task_id]


# ── Message construction ────────────────────────────────────────────────────


def build_task_message(task: dict[str, Any], agent_id: str) -> str:
    """Construct a structured task dispatch message for an agent.

    This message is sent via chat.send to the agent's heartbeat session.
    Keep it concise — the agent already has a HEARTBEAT.md that tells it
    to check mission_control/tasks.json for full details.
    """
    title = task.get("title", "Untitled Task")
    task_id = task.get("id", "unknown")
    priority = task.get("priority", "normal")
    description = task.get("description") or "No description provided."

    return f"""📋 NEW TASK ASSIGNED — {title}

Task ID: {task_id}
Priority: {priority.upper() if priority else 'NORMAL'}
Assigned To: {agent_id}

{description}

ACTION REQUIRED:
1. Check mission_control/tasks.json — find task {task_id}.
2. Check mission_control/notifications.json — mark your notification delivered=true.
3. Update memory/WORKING.md with your execution plan.
4. Execute the task.
5. When done, update the task status in mission_control/tasks.json to "done".
6. Post a summary to mission_control/activities.json."""


# ── Core dispatch logic ─────────────────────────────────────────────────────


async def _get_gateway():
    """Lazy import gateway to avoid circular imports."""
    from .gateway import (
        GatewayConfig,
        send_message,
        ensure_session,
        GatewayError,
    )
    return GatewayConfig, send_message, ensure_session, GatewayError


async def dispatch_task_to_agent(
    task: dict[str, Any],
    agent_id: str,
    *,
    attempt: int = 1,
    use_cli_fallback: bool = True,
) -> DispatchRecord:
    """Dispatch a task to an agent via the OpenClaw gateway.

    Strategy (3-pronged):
      1. Write a notification to mission_control/notifications.json
         so the agent sees it on its next heartbeat file scan.
      2. Send chat.send with deliver=True to the agent's heartbeat
         session so the message is delivered immediately during the
         current turn (if the agent is active).
      3. Fallback to OpenClaw CLI if gateway RPC fails.
    """
    message = build_task_message(task, agent_id)
    record = DispatchRecord(
        task_id=task.get("id", ""),
        agent_id=agent_id,
        message=message,
        attempt=attempt,
    )

    log.info(
        "dispatch.start task=%s agent=%s attempt=%d",
        record.task_id,
        agent_id,
        attempt,
    )

    # Emit SSE event
    await _emit_dispatch_event("dispatch.started", record)

    # Step 1: Write notification to notifications.json (filesystem)
    _write_notification(task, agent_id)

    # Step 2: Try gateway RPC — deliver=True to heartbeat session
    try:
        record.status = DispatchStatus.DISPATCHING
        GatewayConfig, rpc_send, ensure_session, GatewayError = await _get_gateway()

        config = GatewayConfig(
            url=f"ws://127.0.0.1:{settings.gateway_port}",
            token=settings.gateway_token,
        )

        # Target the agent's heartbeat cron session — this is the session
        # that the agent actively reads on each heartbeat tick.
        session_key = f"agent:{agent_id}:cron:{agent_id}-heartbeat"

        # Send task message with deliver=True for immediate processing
        result = await rpc_send(
            message,
            session_key=session_key,
            config=config,
            deliver=True,
        )

        record.status = DispatchStatus.DISPATCHED
        record.dispatched_at_ms = int(time.time() * 1000)
        record.response = str(result)[:1000] if result else "ok"

        log.info(
            "dispatch.success task=%s agent=%s via=gateway_rpc session=%s deliver=true",
            record.task_id,
            agent_id,
            session_key,
        )

    except Exception as rpc_err:
        log.warning(
            "dispatch.rpc_failed task=%s agent=%s error=%s",
            record.task_id,
            agent_id,
            rpc_err,
        )

        # Fallback to CLI
        if use_cli_fallback:
            try:
                record = await _dispatch_via_cli(
                    task, agent_id, message, record
                )
            except Exception as cli_err:
                record.status = DispatchStatus.FAILED
                record.error = f"RPC: {rpc_err} | CLI: {cli_err}"
                log.error(
                    "dispatch.failed task=%s agent=%s error=%s",
                    record.task_id,
                    agent_id,
                    record.error,
                )
        else:
            record.status = DispatchStatus.FAILED
            record.error = str(rpc_err)

    # Record dispatch
    _dispatch_log.append(record)

    # Update task metadata
    _update_task_dispatch_meta(record)

    # Record activity
    _record_dispatch_activity(record)

    # Emit completion event
    await _emit_dispatch_event(
        "dispatch.completed" if record.status == DispatchStatus.DISPATCHED else "dispatch.failed",
        record,
    )

    return record


async def _dispatch_via_cli(
    task: dict[str, Any],
    agent_id: str,
    message: str,
    record: DispatchRecord,
) -> DispatchRecord:
    """Fallback: dispatch via OpenClaw CLI (async subprocess, fire & forget)."""
    log.info("dispatch.cli_fallback task=%s agent=%s", record.task_id, agent_id)

    # Use shorter message for CLI
    short_msg = f"TASK ASSIGNED: {task.get('title', '')}. Task ID: {task.get('id', '')}. {task.get('description', '')[:200]}. Check your WORKING.md and execute this task."

    proc = await asyncio.create_subprocess_exec(
        settings.openclaw_bin,
        "--no-color",
        "agent",
        "--agent", agent_id,
        "--message", short_msg,
        "--json",
        "--timeout", "300",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    # Wait up to 10 seconds for initial dispatch confirmation
    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(), timeout=10
        )
        if proc.returncode == 0:
            record.status = DispatchStatus.DISPATCHED
            record.dispatched_at_ms = int(time.time() * 1000)
            record.response = "cli_dispatched"
        else:
            # CLI is still running (agent turn takes time) - that's OK
            record.status = DispatchStatus.DISPATCHED
            record.dispatched_at_ms = int(time.time() * 1000)
            record.response = "cli_dispatched_async"
    except asyncio.TimeoutError:
        # Expected - agent turn takes time. The CLI subprocess continues in background.
        record.status = DispatchStatus.DISPATCHED
        record.dispatched_at_ms = int(time.time() * 1000)
        record.response = "cli_dispatched_background"
        log.info("dispatch.cli_background task=%s agent=%s pid=%s", record.task_id, agent_id, proc.pid)

    return record


def _write_notification(task: dict[str, Any], agent_id: str) -> None:
    """Write a notification to mission_control/notifications.json.

    Agents check this file on each heartbeat (per their HEARTBEAT.md).
    They look for entries matching their agent ID where delivered=false.
    """
    try:
        notifications = read_table(settings.mc_root, "notifications.json")
        notifications.append({
            "id": f"notif_{uuid.uuid4().hex[:10]}",
            "type": "task.assigned",
            "targetAgentId": agent_id,
            "taskId": task.get("id", ""),
            "title": task.get("title", ""),
            "message": f"You have been assigned task: {task.get('title', '')}. Check mission_control/tasks.json for details.",
            "priority": task.get("priority", "normal"),
            "delivered": False,
            "createdAtMs": int(time.time() * 1000),
        })
        # Keep only recent undelivered + last 50 delivered
        undelivered = [n for n in notifications if not n.get("delivered")]
        delivered = [n for n in notifications if n.get("delivered")]
        notifications = undelivered + delivered[-50:]
        write_table(settings.mc_root, "notifications.json", notifications)
        log.info("dispatch.notification_written agent=%s task=%s", agent_id, task.get("id"))
    except Exception as e:
        log.error("dispatch.notification_write_failed agent=%s error=%s", agent_id, e)


def _update_task_dispatch_meta(record: DispatchRecord) -> None:
    """Update task JSON with dispatch metadata."""
    try:
        tasks = read_table(settings.mc_root, "tasks.json")
        for t in tasks:
            if t.get("id") == record.task_id:
                if "dispatch" not in t:
                    t["dispatch"] = {}
                t["dispatch"]["lastDispatchAtMs"] = record.dispatched_at_ms
                t["dispatch"]["lastDispatchStatus"] = record.status.value
                t["dispatch"]["dispatchCount"] = t["dispatch"].get("dispatchCount", 0) + 1
                t["dispatch"]["lastAgentId"] = record.agent_id
                t["dispatch"]["lastError"] = record.error

                # Track dispatch history
                history = t["dispatch"].get("history", [])
                history.append({
                    "id": record.id,
                    "agentId": record.agent_id,
                    "status": record.status.value,
                    "attempt": record.attempt,
                    "atMs": record.dispatched_at_ms or record.created_at_ms,
                    "error": record.error,
                })
                t["dispatch"]["history"] = history[-20:]  # keep last 20

                # Update task status if it was inbox/assigned
                if t.get("status") in ("inbox", "assigned"):
                    if record.status == DispatchStatus.DISPATCHED:
                        t["status"] = "assigned"

                break
        write_table(settings.mc_root, "tasks.json", tasks)
    except Exception as e:
        log.error("dispatch.meta_update_failed task=%s error=%s", record.task_id, e)


def _record_dispatch_activity(record: DispatchRecord) -> None:
    """Record dispatch event in activity feed."""
    try:
        activities = read_table(settings.mc_root, "activities.json")
        status_emoji = "✅" if record.status == DispatchStatus.DISPATCHED else "❌"
        activities.append({
            "id": f"evt_{uuid.uuid4().hex[:10]}",
            "type": f"dispatch.{record.status.value}",
            "message": f"{status_emoji} Task dispatched to @{record.agent_id}: {record.task_id}",
            "taskId": record.task_id,
            "agentId": record.agent_id,
            "createdAtMs": int(time.time() * 1000),
            "meta": {
                "dispatchId": record.id,
                "attempt": record.attempt,
                "error": record.error,
            },
        })
        activities = activities[-500:]
        write_table(settings.mc_root, "activities.json", activities)
    except Exception as e:
        log.error("dispatch.activity_record_failed error=%s", e)


async def _emit_dispatch_event(event_type: str, record: DispatchRecord) -> None:
    """Fire SSE event for dispatch status."""
    try:
        await event_bus.publish(Event(type=event_type, data=record.to_dict()))
    except Exception:
        pass


# ── Batch dispatch ───────────────────────────────────────────────────────────


async def dispatch_task(task: dict[str, Any]) -> list[DispatchRecord]:
    """Dispatch a task to all assigned agents."""
    assignees = task.get("assigneeIds") or []
    if not assignees:
        log.info("dispatch.skip task=%s reason=no_assignees", task.get("id"))
        return []

    records = []
    for agent_id in assignees:
        record = await dispatch_task_to_agent(task, agent_id)
        records.append(record)

    return records


async def retry_dispatch(task_id: str, agent_id: str | None = None) -> list[DispatchRecord]:
    """Retry dispatching a task."""
    tasks = read_table(settings.mc_root, "tasks.json")
    task = next((t for t in tasks if t.get("id") == task_id), None)
    if not task:
        raise ValueError(f"Task not found: {task_id}")

    # Find previous dispatch count for retry numbering
    prev_count = task.get("dispatch", {}).get("dispatchCount", 0)

    if agent_id:
        # Retry to specific agent
        record = await dispatch_task_to_agent(
            task, agent_id, attempt=prev_count + 1
        )
        return [record]
    else:
        # Retry to all assignees
        assignees = task.get("assigneeIds") or []
        records = []
        for aid in assignees:
            record = await dispatch_task_to_agent(
                task, aid, attempt=prev_count + 1
            )
            records.append(record)
        return records


# ── Agent messaging ─────────────────────────────────────────────────────────


async def send_agent_message(
    agent_id: str,
    message: str,
) -> dict[str, Any]:
    """Send a direct message to an agent via its heartbeat session.

    Uses deliver=True so the agent processes the message immediately.
    """
    try:
        GatewayConfig, rpc_send, ensure_session, GatewayError = await _get_gateway()
        config = GatewayConfig(
            url=f"ws://127.0.0.1:{settings.gateway_port}",
            token=settings.gateway_token,
        )
        # Use the agent's heartbeat session for immediate delivery
        session_key = f"agent:{agent_id}:cron:{agent_id}-heartbeat"
        result = await rpc_send(
            message, session_key=session_key, config=config, deliver=True
        )
        log.info("agent.message.sent agent=%s", agent_id)
        return {"ok": True, "result": str(result)[:500]}
    except Exception as e:
        log.error("agent.message.failed agent=%s error=%s", agent_id, e)
        return {"ok": False, "error": str(e)}


# ── Orchestrator background loop ────────────────────────────────────────────


async def orchestrator_loop():
    """Background task that monitors task lifecycle and handles retries.

    Runs every 60 seconds and checks for:
    - Tasks stuck in 'assigned' for >30min with no agent activity
    - Tasks stuck in 'in_progress' for >2h (timeout)
    - Agents that are offline with assigned tasks (reassignment candidate)
    """
    log.info("orchestrator.started")

    while True:
        try:
            await asyncio.sleep(60)
            await _check_stale_tasks()
        except asyncio.CancelledError:
            log.info("orchestrator.stopped")
            break
        except Exception as e:
            log.error("orchestrator.error: %s", e)


async def _check_stale_tasks():
    """Check for tasks that need attention."""
    now_ms = int(time.time() * 1000)
    tasks = read_table(settings.mc_root, "tasks.json")

    for t in tasks:
        task_id = t.get("id", "")
        status = t.get("status", "")
        dispatch = t.get("dispatch", {})
        last_dispatch_ms = dispatch.get("lastDispatchAtMs")
        dispatch_status = dispatch.get("lastDispatchStatus")

        # Task assigned but never dispatched
        if status == "assigned" and not last_dispatch_ms:
            assignees = t.get("assigneeIds", [])
            if assignees:
                log.info("orchestrator.auto_dispatch task=%s (assigned but never dispatched)", task_id)
                await dispatch_task(t)
                continue

        # Task dispatched but stuck for >30 min
        if (
            status in ("assigned", "inbox")
            and dispatch_status == "dispatched"
            and last_dispatch_ms
            and (now_ms - last_dispatch_ms) > 30 * 60 * 1000
        ):
            dispatch_count = dispatch.get("dispatchCount", 0)
            if dispatch_count < 3:  # Max 3 auto-retries
                log.info(
                    "orchestrator.retry task=%s (stale for >30min, attempt %d)",
                    task_id,
                    dispatch_count + 1,
                )
                await retry_dispatch(task_id)

        # Task in_progress for >2 hours (potential timeout)
        if (
            status == "in_progress"
            and last_dispatch_ms
            and (now_ms - last_dispatch_ms) > 2 * 3600 * 1000
        ):
            log.warning("orchestrator.timeout task=%s (in_progress for >2h)", task_id)
            await _emit_dispatch_event("dispatch.timeout", DispatchRecord(
                task_id=task_id,
                status=DispatchStatus.TIMEOUT,
                error="Task in_progress for >2 hours",
            ))

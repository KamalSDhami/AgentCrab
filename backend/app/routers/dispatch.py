"""Dispatch, agent control, and observability API endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..config import settings, log
from ..data import read_table
from ..services.dispatcher import (
    dispatch_task,
    dispatch_task_to_agent,
    retry_dispatch,
    send_agent_message,
    get_dispatch_log,
    get_dispatch_for_task,
)

router = APIRouter(tags=["dispatch"])


# ── Schemas ──────────────────────────────────────────────────────────────────


class DispatchRequest(BaseModel):
    agent_id: str | None = None


class MessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)


class WakeRequest(BaseModel):
    mode: str = "now"
    text: str | None = None


# ── Task dispatch ────────────────────────────────────────────────────────────


@router.post("/dispatch/{task_id}")
async def dispatch_task_endpoint(
    task_id: str,
    payload: DispatchRequest | None = None,
) -> dict[str, Any]:
    """Dispatch a task to its assigned agents via the OpenClaw gateway."""
    tasks = read_table(settings.mc_root, "tasks.json")
    task = next((t for t in tasks if t.get("id") == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if payload and payload.agent_id:
        records = [await dispatch_task_to_agent(task, payload.agent_id)]
    else:
        records = await dispatch_task(task)

    if not records:
        raise HTTPException(
            status_code=400,
            detail="No agents assigned to this task. Assign an agent first.",
        )

    return {
        "ok": True,
        "dispatched": len(records),
        "records": [r.to_dict() for r in records],
    }


@router.post("/dispatch/{task_id}/retry")
async def retry_dispatch_endpoint(
    task_id: str,
    payload: DispatchRequest | None = None,
) -> dict[str, Any]:
    """Retry dispatching a task."""
    try:
        records = await retry_dispatch(
            task_id,
            agent_id=payload.agent_id if payload else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {
        "ok": True,
        "retried": len(records),
        "records": [r.to_dict() for r in records],
    }


# ── Dispatch logs ────────────────────────────────────────────────────────────


@router.get("/dispatch/logs")
def dispatch_logs(limit: int = 100) -> list[dict[str, Any]]:
    """Return recent dispatch log entries."""
    return get_dispatch_log(limit)


@router.get("/dispatch/logs/{task_id}")
def dispatch_logs_for_task(task_id: str) -> list[dict[str, Any]]:
    """Return dispatch logs for a specific task."""
    return get_dispatch_for_task(task_id)


# ── Agent control ────────────────────────────────────────────────────────────


@router.post("/agents/{agent_id}/message")
async def send_message_to_agent(
    agent_id: str,
    payload: MessageRequest,
) -> dict[str, Any]:
    """Send a direct message to an agent via the gateway."""
    result = await send_agent_message(agent_id, payload.message)
    if not result.get("ok"):
        raise HTTPException(status_code=502, detail=result.get("error", "Gateway error"))
    return result


@router.post("/agents/{agent_id}/wake")
async def wake_agent_endpoint(
    agent_id: str,
    payload: WakeRequest | None = None,
) -> dict[str, Any]:
    """Wake an agent via chat.send with deliver=True.

    Uses the same approach as the reference OpenClaw Mission Control:
    ensure_session → chat.send(deliver=True) to agent heartbeat session.
    Falls back to raw wake RPC with correct schema if chat.send fails.
    """
    try:
        from ..services.gateway import GatewayConfig, wake_agent

        config = GatewayConfig(
            url=f"ws://127.0.0.1:{settings.gateway_port}",
            token=settings.gateway_token,
        )
        mode = payload.mode if payload else "heartbeat"
        text = payload.text if payload else None
        result = await wake_agent(
            agent_id, config=config, mode=mode, text=text,
        )
        log.info("agent.wake.ok agent=%s", agent_id)
        return {"ok": True, "agent": agent_id, "result": str(result)[:500]}
    except Exception as e:
        log.error("agent.wake.failed agent=%s error=%s", agent_id, e)
        raise HTTPException(status_code=502, detail=f"Wake failed: {e}")


# ── Gateway health ───────────────────────────────────────────────────────────


@router.get("/gateway/health")
async def gateway_health_endpoint() -> dict[str, Any]:
    """Check OpenClaw gateway health."""
    try:
        from ..services.gateway import GatewayConfig, gateway_health

        config = GatewayConfig(
            url=f"ws://127.0.0.1:{settings.gateway_port}",
            token=settings.gateway_token,
        )
        result = await gateway_health(config=config)
        return {"ok": True, "gateway": result}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ── Observability: Delegation & Supervisor ───────────────────────────────────


@router.get("/supervisor/delegations")
def delegation_log_endpoint(limit: int = 100) -> list[dict[str, Any]]:
    """Return recent delegation records from the supervisor layer."""
    from ..services.supervisor import get_delegation_log
    return get_delegation_log(limit)


@router.get("/supervisor/capabilities")
def capabilities_endpoint() -> dict[str, Any]:
    """Return the full agent capability registry."""
    from ..services.supervisor import AGENT_CAPABILITIES
    return AGENT_CAPABILITIES


@router.get("/supervisor/state-machine")
def state_machine_endpoint() -> dict[str, Any]:
    """Return the valid state transitions for reference."""
    from ..services.supervisor import VALID_TRANSITIONS
    return {"transitions": VALID_TRANSITIONS}


@router.get("/rpc/payload/{task_id}")
def rpc_payload_viewer(task_id: str) -> dict[str, Any]:
    """View the RPC payload that would be sent for a task dispatch.

    Useful for debugging — shows exactly what message and params
    the gateway would receive, without actually sending.
    """
    tasks = read_table(settings.mc_root, "tasks.json")
    task = next((t for t in tasks if t.get("id") == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    from ..services.dispatcher import build_task_message
    assignees = task.get("assigneeIds") or []
    payloads = []
    for aid in assignees:
        msg = build_task_message(task, aid)
        session_key = f"agent:{aid}:cron:{aid}-heartbeat"
        payloads.append({
            "agentId": aid,
            "sessionKey": session_key,
            "deliver": True,
            "messagePreview": msg[:500],
            "messageLength": len(msg),
            "rpcMethod": "chat.send",
            "rpcParams": {
                "sessionKey": session_key,
                "message": msg,
                "deliver": True,
                "idempotencyKey": "<uuid>",
            },
        })

    return {
        "taskId": task_id,
        "assignees": assignees,
        "payloads": payloads,
    }

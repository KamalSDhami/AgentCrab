"""Dispatch and agent control API endpoints."""

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
    agent_id: str | None = None  # If None, dispatch to all assignees


class MessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)


class WakeRequest(BaseModel):
    pass


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
async def wake_agent_endpoint(agent_id: str) -> dict[str, Any]:
    """Wake an agent (trigger immediate heartbeat)."""
    try:
        from ..services.gateway import GatewayConfig, wake_agent

        config = GatewayConfig(
            url=f"ws://127.0.0.1:{settings.gateway_port}",
            token=settings.gateway_token,
        )
        result = await wake_agent(agent_id, config=config)
        log.info("agent.wake agent=%s", agent_id)
        return {"ok": True, "result": str(result)[:500]}
    except Exception as e:
        log.error("agent.wake.failed agent=%s error=%s", agent_id, e)
        raise HTTPException(status_code=502, detail=str(e))


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

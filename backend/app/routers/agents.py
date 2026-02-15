"""Agent endpoints — list, detail, workspace file reading."""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException

from ..config import settings, log
from ..data import read_table
from ..events import event_bus, Event
from ..services.openclaw import get_cron_jobs, get_cron_runs

router = APIRouter(prefix="/agents", tags=["agents"])

# ── Redaction ────────────────────────────────────────────────────────────────
_REDACT_MARKERS = [
    "BEGIN OPENSSH PRIVATE KEY",
    "botToken",
    "api_key",
    "OPENAI",
    "OPENROUTER",
    "ANTHROPIC",
    "token=",
    "secret",
]


def _safe_read(path: Path, max_chars: int = 20_000) -> str:
    if not path.exists():
        return ""
    text = path.read_text(encoding="utf-8", errors="replace")
    if any(m.lower() in text.lower() for m in _REDACT_MARKERS):
        return "[redacted: possible secret content]"
    return text[:max_chars]


# ── Computed agent list ──────────────────────────────────────────────────────

def _now_ms() -> int:
    return int(time.time() * 1000)


def _derive_agents() -> list[dict[str, Any]]:
    """Return agents with derived lifecycle status from cron heartbeats."""
    agents = read_table(settings.mc_root, "agents.json")
    tasks = read_table(settings.mc_root, "tasks.json")

    cron = get_cron_jobs()
    jobs = cron.get("jobs", []) if isinstance(cron, dict) else []
    heartbeat_jobs = [
        j for j in jobs
        if isinstance(j, dict) and str(j.get("id", "")).endswith("-heartbeat")
    ]
    now = _now_ms()

    result: list[dict[str, Any]] = []
    for a in agents:
        aid = str(a.get("id", ""))

        # Tasks assigned to this agent
        a_tasks = [t for t in tasks if aid in (t.get("assigneeIds") or [])]
        in_progress = [t for t in a_tasks if t.get("status") == "in_progress"]
        pending = [t for t in a_tasks if t.get("status") not in ("done",)]

        # Heartbeat lookup
        hj = next((j for j in heartbeat_jobs if j.get("agentId") == aid), None)
        state = (hj or {}).get("state") or {}
        last_run = state.get("lastRunAtMs")
        last_status = state.get("lastStatus")
        last_error = state.get("lastError")

        # Derive lifecycle status
        if isinstance(last_run, int) and (now - last_run) > 30 * 60 * 1000:
            derived = "offline"
        elif len(in_progress) > 0:
            derived = "running"
        elif len(pending) > 0:
            derived = "idle"
        elif isinstance(last_run, int):
            derived = "idle"
        else:
            derived = "unknown"

        result.append({
            **a,
            "derivedStatus": derived,
            "lastHeartbeatMs": last_run,
            "lastHeartbeatAgeSec": int((now - last_run) / 1000) if isinstance(last_run, int) else None,
            "lastCronStatus": last_status,
            "lastCronError": last_error,
            "assignedTaskCount": len(pending),
            "inProgressTaskCount": len(in_progress),
            "assignedTaskIds": [t.get("id") for t in pending],
            "inProgressTaskIds": [t.get("id") for t in in_progress],
        })

    return result


@router.get("")
def list_agents() -> list[dict[str, Any]]:
    return _derive_agents()


@router.get("/{agent_id}")
def agent_detail(agent_id: str) -> dict[str, Any]:
    agent_id = agent_id.strip()
    agent_root = Path(settings.agent_workspace_root) / agent_id

    # Find base agent info
    agents = read_table(settings.mc_root, "agents.json")
    base = next((a for a in agents if a.get("id") == agent_id), {"id": agent_id})

    files: dict[str, str] = {}
    if agent_root.exists():
        for fname in [
            "SOUL.md",
            "AGENTS.md",
            "HEARTBEAT.md",
            "memory/WORKING.md",
        ]:
            files[fname] = _safe_read(agent_root / fname)
    else:
        log.debug("Agent workspace not found: %s", agent_root)

    return {**base, "files": files, "workspaceExists": agent_root.exists()}


@router.get("/{agent_id}/cron-runs")
def agent_cron_history(agent_id: str, limit: int = 30) -> dict[str, Any]:
    return get_cron_runs(agent_id, limit)

"""OpenClaw cron integration endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

from ..config import settings
from ..services.openclaw import get_cron_jobs

router = APIRouter(tags=["cron"])


@router.get("/cron")
def cron_status() -> dict[str, Any]:
    return get_cron_jobs()


@router.get("/raw/heartbeat-md", response_class=PlainTextResponse)
def heartbeat_md() -> str:
    from pathlib import Path

    shared = Path("/root/.openclaw/workspace/HEARTBEAT.md")
    if not shared.exists():
        return "# HEARTBEAT.md not found on this host"
    text = shared.read_text(encoding="utf-8", errors="replace")
    return text[:20_000]

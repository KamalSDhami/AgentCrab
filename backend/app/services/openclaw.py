"""OpenClaw CLI wrapper — runs `openclaw cron *` commands and parses output."""

from __future__ import annotations

import json
import subprocess
from typing import Any

from ..config import settings, log


def _extract_json(stdout: str) -> Any | None:
    """Extract JSON from CLI output that may contain banner text."""
    s = stdout.strip()
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        pass
    # OpenClaw sometimes prepends "Doctor warnings" banners.
    for idx, line in enumerate(s.splitlines()):
        stripped = line.lstrip()
        if stripped.startswith("{") or stripped.startswith("["):
            candidate = "\n".join(s.splitlines()[idx:]).strip()
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                continue
    return None


def get_cron_jobs() -> dict[str, Any]:
    """Run `openclaw cron list --json` and return parsed result."""
    try:
        proc = subprocess.run(
            [settings.openclaw_bin, "--no-color", "cron", "list", "--json"],
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except FileNotFoundError:
        return {"ok": False, "jobs": [], "error": "openclaw not installed"}
    except subprocess.TimeoutExpired:
        return {"ok": False, "jobs": [], "error": "openclaw timed out"}

    if proc.returncode != 0:
        return {
            "ok": False,
            "jobs": [],
            "error": proc.stderr.strip()[:500],
        }

    payload = _extract_json(proc.stdout)
    if payload is None:
        return {
            "ok": False,
            "jobs": [],
            "error": "invalid json from openclaw",
            "stdout": proc.stdout[:2000],
        }

    if isinstance(payload, dict) and "jobs" in payload:
        payload.setdefault("ok", True)
        return payload
    return {"ok": True, "jobs": payload if isinstance(payload, list) else []}


def get_cron_runs(agent_id: str, limit: int = 30) -> dict[str, Any]:
    """Return cron run history for an agent's heartbeat job."""
    job_id = f"{agent_id}-heartbeat"
    try:
        proc = subprocess.run(
            [
                settings.openclaw_bin,
                "--no-color",
                "cron",
                "runs",
                "--id",
                job_id,
                "--limit",
                str(limit),
            ],
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except FileNotFoundError:
        return {"ok": False, "entries": [], "error": "openclaw not installed"}
    except subprocess.TimeoutExpired:
        return {"ok": False, "entries": [], "error": "timed out"}

    if proc.returncode != 0:
        return {"ok": False, "entries": [], "error": proc.stderr.strip()[:500]}

    payload = _extract_json(proc.stdout)
    if payload is None:
        return {"ok": False, "entries": [], "error": "invalid json"}
    return payload

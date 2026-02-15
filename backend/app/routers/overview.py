"""Dashboard overview — aggregated stats endpoint."""

from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter

from ..config import settings
from ..data import read_table
from ..services.openclaw import get_cron_jobs

router = APIRouter(tags=["overview"])


def _now_ms() -> int:
    return int(time.time() * 1000)


@router.get("/overview")
def overview() -> dict[str, Any]:
    agents = read_table(settings.mc_root, "agents.json")
    tasks = read_table(settings.mc_root, "tasks.json")
    activities = read_table(settings.mc_root, "activities.json")

    pending = [t for t in tasks if t.get("status") not in ("done",)]
    completed = [t for t in tasks if t.get("status") == "done"]
    in_progress = [t for t in tasks if t.get("status") == "in_progress"]
    in_review = [t for t in tasks if t.get("status") == "review"]

    # Derive agent health from cron
    cron = get_cron_jobs()
    jobs = cron.get("jobs", []) if isinstance(cron, dict) else []
    heartbeat_jobs = [
        j for j in jobs
        if isinstance(j, dict) and str(j.get("id", "")).endswith("-heartbeat")
    ]
    now = _now_ms()
    online = 0
    offline = 0
    for a in agents:
        hj = next(
            (j for j in heartbeat_jobs if j.get("agentId") == a.get("id")), None
        )
        last = ((hj or {}).get("state") or {}).get("lastRunAtMs")
        if isinstance(last, int) and (now - last) <= 30 * 60 * 1000:
            online += 1
        else:
            offline += 1

    return {
        "agents": {
            "total": len(agents),
            "online": online,
            "offline": offline,
        },
        "tasks": {
            "total": len(tasks),
            "pending": len(pending),
            "inProgress": len(in_progress),
            "review": len(in_review),
            "completed": len(completed),
        },
        "activity": {
            "total": len(activities),
            "recent": len([
                a for a in activities
                if isinstance(a.get("createdAtMs"), int)
                and (now - a["createdAtMs"]) < 3600 * 1000
            ]),
        },
        "cron": {
            "ok": cron.get("ok", False) if isinstance(cron, dict) else False,
            "jobCount": len(jobs),
            "heartbeatCount": len(heartbeat_jobs),
        },
        "nowMs": now,
    }

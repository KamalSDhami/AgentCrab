from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .settings import settings
from .storage import read_json_file


def _mc_path(name: str) -> Path:
    safe = name.replace("..", "").replace("/", "").replace("\\", "")
    return Path(settings.mc_root) / safe


app = FastAPI(title="Agent Monitor API", version="0.1.0")

if settings.serve_static:
    static_path = Path(__file__).resolve().parent / settings.static_dir
    if static_path.exists():
        app.mount("/", StaticFiles(directory=str(static_path), html=True), name="static")

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"]
)


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "mc_root": settings.mc_root,
    }


@app.get("/api/mc/{table}")
def get_table(table: str) -> Any:
    allowed = {
        "agents.json",
        "tasks.json",
        "messages.json",
        "activities.json",
        "documents.json",
        "notifications.json",
    }
    if table not in allowed:
        raise HTTPException(status_code=404, detail="unknown table")

    path = _mc_path(table)
    data = read_json_file(path)
    if data is None:
        # Local-friendly default: missing tables behave as empty lists.
        return []
    return data


@app.get("/api/cron")
def cron_status() -> Any:
    try:
        proc = subprocess.run(
            [settings.openclaw_bin, "cron", "list", "--json"],
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except FileNotFoundError as exc:
        # Local Windows dev won't have openclaw installed. Return a non-fatal payload.
        return {"ok": False, "jobs": [], "error": f"openclaw not found: {exc}"}
    except subprocess.TimeoutExpired:
        return {"ok": False, "jobs": [], "error": "openclaw cron list timed out"}

    stdout = proc.stdout.strip()
    if proc.returncode != 0:
        return {"ok": False, "jobs": [], "error": {"exitCode": proc.returncode, "stderr": proc.stderr.strip()}}

    try:
        payload = json.loads(stdout)
        if isinstance(payload, dict) and "jobs" in payload:
            payload.setdefault("ok", True)
            return payload
        return {"ok": True, "jobs": payload}
    except json.JSONDecodeError:
        return {"ok": False, "jobs": [], "error": {"error": "invalid json from openclaw", "stdout": stdout[:2000]}}

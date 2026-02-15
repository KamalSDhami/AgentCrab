from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

import os

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .settings import settings
from .storage import read_json_file, write_json_file


def _mc_path(name: str) -> Path:
    safe = name.replace("..", "").replace("/", "").replace("\\", "")
    return Path(settings.mc_root) / safe


app = FastAPI(title="Agent Monitor API", version="0.1.0")

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"]
)


def _static_dist_path() -> Path:
    configured = Path(settings.static_dir)
    if configured.is_absolute():
        return configured
    # Resolve relative to the process working directory (systemd WorkingDirectory=/opt/AgentCrab/backend)
    return Path(os.getcwd()) / configured


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "mc_root": settings.mc_root,
    }


def _now_ms() -> int:
    return int(__import__("time").time() * 1000)


def _load_table(name: str) -> Any:
    return read_json_file(_mc_path(name)) or []


def _extract_first_json(stdout: str) -> Any | None:
    s = stdout.strip()
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        pass
    lines = s.splitlines()
    for idx, line in enumerate(lines):
        if line.lstrip().startswith("{") or line.lstrip().startswith("["):
            candidate = "\n".join(lines[idx:]).strip()
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                continue
    return None


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


@app.get("/api/overview")
def overview() -> dict[str, Any]:
    agents: list[dict[str, Any]] = _load_table("agents.json")
    tasks: list[dict[str, Any]] = _load_table("tasks.json")

    pending = [t for t in tasks if t.get("status") not in ("done",)]
    completed = [t for t in tasks if t.get("status") == "done"]

    # Derive quick health from cron heartbeats when available.
    cron = cron_status()
    jobs = cron.get("jobs", []) if isinstance(cron, dict) else []
    heartbeat_jobs = [j for j in jobs if isinstance(j, dict) and str(j.get("id", "")).endswith("-heartbeat")]
    now = _now_ms()
    offline = 0
    active = 0
    for a in agents:
        agent_id = a.get("id")
        hj = next((j for j in heartbeat_jobs if j.get("agentId") == agent_id), None)
        last = ((hj or {}).get("state") or {}).get("lastRunAtMs")
        if isinstance(last, int) and (now - last) > 30 * 60 * 1000:
            offline += 1
        else:
            active += 1

    return {
        "agents": {
            "total": len(agents),
            "active": active,
            "offline": offline,
        },
        "tasks": {
            "pending": len(pending),
            "completed": len(completed),
            "total": len(tasks),
        },
        "cron": {
            "ok": bool(getattr(cron, "get", lambda *_: False)("ok")) if isinstance(cron, dict) else False,
        },
        "nowMs": now,
    }


@app.get("/api/agents")
def agents_computed() -> list[dict[str, Any]]:
    agents: list[dict[str, Any]] = _load_table("agents.json")
    tasks: list[dict[str, Any]] = _load_table("tasks.json")

    cron = cron_status()
    jobs = cron.get("jobs", []) if isinstance(cron, dict) else []
    heartbeat_jobs = [j for j in jobs if isinstance(j, dict) and str(j.get("id", "")).endswith("-heartbeat")]
    now = _now_ms()

    def assigned_tasks(agent_id: str) -> list[dict[str, Any]]:
        out = []
        for t in tasks:
            if agent_id in (t.get("assigneeIds") or []):
                out.append(t)
        return out

    result: list[dict[str, Any]] = []
    for a in agents:
        agent_id = str(a.get("id"))
        a_tasks = assigned_tasks(agent_id)
        in_progress = [t for t in a_tasks if t.get("status") == "in_progress"]
        pending = [t for t in a_tasks if t.get("status") not in ("done",)]

        hj = next((j for j in heartbeat_jobs if j.get("agentId") == agent_id), None)
        last_run = ((hj or {}).get("state") or {}).get("lastRunAtMs")
        last_status = ((hj or {}).get("state") or {}).get("lastStatus")
        last_error = ((hj or {}).get("state") or {}).get("lastError")

        derived = "idle"
        if isinstance(last_run, int) and (now - last_run) > 30 * 60 * 1000:
            derived = "offline"
        elif len(in_progress) > 0:
            derived = "processing"
        elif len(pending) > 0:
            derived = "waiting"

        result.append(
            {
                **a,
                "derivedStatus": derived,
                "lastHeartbeatMs": last_run,
                "lastHeartbeatAgeSec": int((now - last_run) / 1000) if isinstance(last_run, int) else None,
                "lastCronStatus": last_status,
                "lastCronError": last_error,
                "assignedTaskIds": [t.get("id") for t in pending],
                "inProgressTaskIds": [t.get("id") for t in in_progress],
            }
        )

    return result


def _safe_read_text(path: Path, max_chars: int = 20000) -> str:
    if not path.exists():
        return ""
    text = path.read_text(encoding="utf-8", errors="replace")
    # Basic redaction (defensive): don't leak obvious secrets in the UI.
    redaction_markers = ["BEGIN OPENSSH PRIVATE KEY", "botToken", "api_key", "OPENAI", "OPENROUTER", "ANTHROPIC", "token="]
    if any(m.lower() in text.lower() for m in redaction_markers):
        return "[redacted: possible secret content]"
    return text[:max_chars]


@app.get("/api/agent/{agent_id}")
def agent_detail(agent_id: str) -> dict[str, Any]:
    agent_id = agent_id.strip()
    agent_root = Path("/root/.openclaw/workspace/agents") / agent_id
    if not agent_root.exists():
        # In local dev this path won't exist; return minimal.
        return {"id": agent_id, "files": {}, "note": "agent workspace not found on this host"}

    files = {
        "SOUL.md": _safe_read_text(agent_root / "SOUL.md"),
        "AGENTS.md": _safe_read_text(agent_root / "AGENTS.md"),
        "HEARTBEAT.md": _safe_read_text(agent_root / "HEARTBEAT.md"),
        "memory/WORKING.md": _safe_read_text(agent_root / "memory" / "WORKING.md"),
    }

    return {"id": agent_id, "files": files}


@app.get("/api/agent/{agent_id}/cron-runs")
def agent_cron_runs(agent_id: str, limit: int = 20) -> Any:
    # Returns cron runs for <agent>-heartbeat when openclaw is available.
    job_id = f"{agent_id}-heartbeat"
    try:
        proc = subprocess.run(
            [settings.openclaw_bin, "--no-color", "cron", "runs", "--id", job_id, "--limit", str(limit)],
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except FileNotFoundError:
        return {"ok": False, "entries": [], "error": "openclaw not found"}

    if proc.returncode != 0:
        return {"ok": False, "entries": [], "error": proc.stderr.strip()}

    payload = _extract_first_json(proc.stdout)
    if payload is None:
        return {"ok": False, "entries": [], "error": "invalid json", "stdout": proc.stdout[:2000]}
    return payload


@app.get("/api/raw/heartbeat-md", response_class=PlainTextResponse)
def heartbeat_md() -> str:
    # Useful for debugging: what agents are being told to do.
    shared = Path("/root/.openclaw/workspace/HEARTBEAT.md")
    return _safe_read_text(shared)


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    status: str = "inbox"
    assigneeIds: list[str] = Field(default_factory=list)
    priority: str | None = None
    deadline: str | None = None


class TaskPatch(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    status: str | None = None
    assigneeIds: list[str] | None = None
    priority: str | None = None
    deadline: str | None = None


@app.post("/api/tasks")
def create_task(payload: TaskCreate) -> dict[str, Any]:
    tasks: list[dict[str, Any]] = _load_table("tasks.json")
    task_id = f"task_{__import__('uuid').uuid4().hex[:10]}"
    task = {
        "id": task_id,
        "title": payload.title,
        "description": payload.description,
        "status": payload.status,
        "assigneeIds": payload.assigneeIds,
        "priority": payload.priority,
        "deadline": payload.deadline,
        "createdAtMs": _now_ms(),
    }
    tasks.append(task)
    write_json_file(_mc_path("tasks.json"), tasks)
    _append_activity({"type": "task_created", "message": payload.title, "taskId": task_id})
    return task


@app.patch("/api/tasks/{task_id}")
def patch_task(task_id: str, payload: TaskPatch) -> dict[str, Any]:
    tasks: list[dict[str, Any]] = _load_table("tasks.json")
    for t in tasks:
        if t.get("id") == task_id:
            for k, v in payload.model_dump(exclude_unset=True).items():
                t[k] = v
            t["updatedAtMs"] = _now_ms()
            write_json_file(_mc_path("tasks.json"), tasks)
            _append_activity({"type": "task_updated", "message": f"{task_id} updated", "taskId": task_id})
            return t
    raise HTTPException(status_code=404, detail="task not found")


def _append_activity(entry: dict[str, Any]) -> None:
    activities: list[dict[str, Any]] = _load_table("activities.json")
    entry = {**entry}
    entry.setdefault("id", f"evt_{__import__('uuid').uuid4().hex[:10]}")
    entry.setdefault("createdAtMs", _now_ms())
    activities.append(entry)
    # Keep the file bounded.
    activities = activities[-500:]
    write_json_file(_mc_path("activities.json"), activities)


class MessageCreate(BaseModel):
    taskId: str | None = None
    fromAgentId: str | None = None
    content: str = Field(min_length=1, max_length=8000)


@app.post("/api/messages")
def create_message(payload: MessageCreate) -> dict[str, Any]:
    messages: list[dict[str, Any]] = _load_table("messages.json")
    msg = {
        "id": f"msg_{__import__('uuid').uuid4().hex[:10]}",
        "taskId": payload.taskId,
        "fromAgentId": payload.fromAgentId,
        "content": payload.content,
        "createdAtMs": _now_ms(),
    }
    messages.append(msg)
    messages = messages[-1000:]
    write_json_file(_mc_path("messages.json"), messages)
    _append_activity({"type": "message_sent", "message": payload.content[:140], "taskId": payload.taskId, "agentId": payload.fromAgentId})
    return msg


@app.get("/api/cron")
def cron_status() -> Any:
    try:
        proc = subprocess.run(
            [settings.openclaw_bin, "--no-color", "cron", "list", "--json"],
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

    def _try_parse_json(maybe: str) -> Any | None:
        try:
            return json.loads(maybe)
        except json.JSONDecodeError:
            return None

    # OpenClaw may print "Doctor warnings" banners before the JSON.
    payload = _try_parse_json(stdout)
    if payload is None:
        lines = stdout.splitlines()
        for idx, line in enumerate(lines):
            if line.lstrip().startswith("{"):
                candidate = "\n".join(lines[idx:]).strip()
                payload = _try_parse_json(candidate)
                if payload is not None:
                    break

    if payload is None:
        return {"ok": False, "jobs": [], "error": {"error": "invalid json from openclaw", "stdout": stdout[:2000]}}

    if isinstance(payload, dict) and "jobs" in payload:
        payload.setdefault("ok", True)
        return payload
    return {"ok": True, "jobs": payload}


# Mount static frontend last so /api/* routes still work.
if settings.serve_static:
    static_path = _static_dist_path()
    if static_path.exists():
        app.mount("/", StaticFiles(directory=str(static_path), html=True), name="static")

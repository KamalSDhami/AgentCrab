"""Application configuration with environment variable support."""

from __future__ import annotations

import logging
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_mc_root() -> str:
    project_root = Path(__file__).resolve().parents[2]
    local_mc = project_root / "mission_control"
    if (local_mc / "agents.json").exists():
        return str(local_mc)
    return "/root/.openclaw/workspace/mission_control"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mc_root: str = _default_mc_root()
    openclaw_bin: str = "openclaw"
    agent_workspace_root: str = "/root/.openclaw/workspace/agents"

    serve_static: bool = False
    static_dir: str = "../frontend/dist"

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    log_level: str = "INFO"

    # SSE keepalive interval in seconds
    sse_keepalive: int = 15

    # OpenClaw Gateway
    gateway_port: int = 18789
    gateway_token: str = ""

    # Dispatch settings
    auto_dispatch: bool = True           # auto-dispatch tasks on create/assign
    dispatch_retry_max: int = 3          # max auto-retries
    dispatch_stale_minutes: int = 30     # re-dispatch after this many minutes
    orchestrator_enabled: bool = True    # run background orchestrator loop


settings = Settings()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)-18s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("agentcrab")

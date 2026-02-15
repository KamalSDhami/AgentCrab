from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


def _default_mc_root() -> str:
    # settings.py -> app/ -> backend/ -> agent-monitor/
    project_root = Path(__file__).resolve().parents[2]
    local_mc = project_root / "mission_control"
    if (local_mc / "agents.json").exists():
        return str(local_mc)
    return "/root/.openclaw/workspace/mission_control"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mc_root: str = _default_mc_root()
    openclaw_bin: str = "openclaw"

    serve_static: bool = False
    static_dir: str = "../frontend/dist"

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"


settings = Settings()

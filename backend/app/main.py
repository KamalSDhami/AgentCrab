"""
AgentCrab — Mission Control API
================================
FastAPI application with modular routers, SSE streaming,
structured logging, and OpenClaw integration.
"""

from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncGenerator

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings, log
from .routers import health, agents, tasks, activity, cron, streams, overview


# ── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    log.info("AgentCrab starting — mc_root=%s", settings.mc_root)
    yield
    log.info("AgentCrab shutting down")


# ── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="AgentCrab — Mission Control",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS
origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# ── Request logging middleware ───────────────────────────────────────────────

@app.middleware("http")
async def log_requests(request: Request, call_next: Any) -> Response:
    start = time.perf_counter()
    response: Response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    if elapsed_ms > 500:
        log.warning(
            "SLOW %s %s — %dms — %d",
            request.method,
            request.url.path,
            int(elapsed_ms),
            response.status_code,
        )
    return response


# ── Register routers ────────────────────────────────────────────────────────

app.include_router(health.router, prefix="/api")
app.include_router(overview.router, prefix="/api")
app.include_router(agents.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(activity.router, prefix="/api")
app.include_router(cron.router, prefix="/api")
app.include_router(streams.router, prefix="/api")


# ── Static frontend (production) ────────────────────────────────────────────

def _static_dist_path() -> Path:
    configured = Path(settings.static_dir)
    if configured.is_absolute():
        return configured
    return Path(os.getcwd()) / configured


if settings.serve_static:
    static_path = _static_dist_path()
    if static_path.exists():
        app.mount("/", StaticFiles(directory=str(static_path), html=True), name="static")
        log.info("Serving static frontend from %s", static_path)
    else:
        log.warning("Static dir not found: %s", static_path)

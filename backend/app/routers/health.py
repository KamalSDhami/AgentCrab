"""Health and readiness probe endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from ..config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "mc_root": settings.mc_root,
        "version": "2.0.0",
    }


@router.get("/readyz")
def readyz() -> dict[str, bool]:
    from pathlib import Path

    mc_ok = Path(settings.mc_root).is_dir()
    return {"ok": mc_ok}

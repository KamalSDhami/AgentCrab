"""SSE streaming endpoint for real-time frontend updates."""

from __future__ import annotations

import asyncio
import json
from typing import AsyncGenerator

from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

from ..config import settings
from ..events import event_bus

router = APIRouter(tags=["streams"])


async def _event_generator() -> AsyncGenerator[dict[str, str], None]:
    queue = await event_bus.subscribe()
    try:
        while True:
            try:
                event = await asyncio.wait_for(
                    queue.get(), timeout=settings.sse_keepalive
                )
                if event is None:
                    break
                yield event.to_sse_dict()
            except asyncio.TimeoutError:
                # Send keepalive comment
                yield {"comment": "keepalive"}
    finally:
        await event_bus.unsubscribe(queue)


@router.get("/streams/events")
async def event_stream() -> EventSourceResponse:
    """SSE endpoint — streams all system events in real time."""
    return EventSourceResponse(
        _event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

"""In-memory event bus for SSE broadcasting to connected clients."""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from collections import deque
from typing import Any


@dataclass
class Event:
    """A single event that can be published to SSE subscribers."""

    type: str
    data: dict[str, Any]
    timestamp: float = field(default_factory=time.time)
    id: str = ""

    def __post_init__(self) -> None:
        if not self.id:
            self.id = f"{self.type}_{int(self.timestamp * 1000)}"

    def to_sse_dict(self) -> dict[str, str]:
        import json

        return {
            "event": self.type,
            "id": self.id,
            "data": json.dumps(self.data, default=str),
        }


class EventBus:
    """Publish/subscribe event bus with history buffer."""

    def __init__(self, max_history: int = 500) -> None:
        self._subscribers: list[asyncio.Queue[Event | None]] = []
        self._history: deque[Event] = deque(maxlen=max_history)
        self._lock = asyncio.Lock()

    async def publish(self, event: Event) -> None:
        """Broadcast an event to all subscribers."""
        async with self._lock:
            self._history.append(event)
            dead: list[asyncio.Queue[Event | None]] = []
            for q in self._subscribers:
                try:
                    q.put_nowait(event)
                except asyncio.QueueFull:
                    dead.append(q)
            for q in dead:
                self._subscribers.remove(q)

    async def subscribe(self) -> asyncio.Queue[Event | None]:
        """Create a new subscription queue."""
        q: asyncio.Queue[Event | None] = asyncio.Queue(maxsize=256)
        async with self._lock:
            self._subscribers.append(q)
        return q

    async def unsubscribe(self, q: asyncio.Queue[Event | None]) -> None:
        """Remove a subscription queue."""
        async with self._lock:
            if q in self._subscribers:
                self._subscribers.remove(q)

    def recent(self, n: int = 50) -> list[Event]:
        """Return the N most recent events."""
        items = list(self._history)
        return items[-n:]


# Global singleton
event_bus = EventBus()

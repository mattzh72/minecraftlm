"""
Session event buffer for SSE stream resumption.

Implements a pub-sub pattern where the agent writes events to a buffer,
and SSE streams subscribe/unsubscribe independently.
"""

import asyncio
from typing import Any, AsyncIterator

from cachetools import TTLCache


class SessionEventBuffer:
    """Buffer for storing and streaming session events."""

    def __init__(self):
        self.events: list[dict[str, Any]] = []
        self.is_complete: bool = False
        self.error: str | None = None
        self._subscribers: list[asyncio.Queue[dict[str, Any]]] = []
        self._lock = asyncio.Lock()

    def append(self, event: dict[str, Any]) -> None:
        """Add event and notify all subscribers."""
        self.events.append(event)
        for queue in self._subscribers:
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                pass  # Skip if queue is full (shouldn't happen with unbounded queues)

    def mark_complete(self, error: str | None = None) -> None:
        """Mark the buffer as complete (agent finished)."""
        self.is_complete = True
        self.error = error
        # Wake up all subscribers by putting a sentinel
        for queue in self._subscribers:
            try:
                queue.put_nowait({"type": "_complete_sentinel"})
            except asyncio.QueueFull:
                pass

    async def subscribe(self) -> AsyncIterator[dict[str, Any]]:
        """
        Yield past events, then stream new ones until complete.

        On disconnect (generator close), subscriber is automatically cleaned up.
        """
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()

        async with self._lock:
            self._subscribers.append(queue)

        try:
            # Replay all existing events
            for event in self.events:
                yield event

            # If already complete, we're done
            if self.is_complete:
                return

            # Stream new events
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30)
                    # Check for sentinel
                    if event.get("type") == "_complete_sentinel":
                        return
                    yield event
                except asyncio.TimeoutError:
                    # Send a keep-alive comment (client ignores these)
                    yield {"type": "_keepalive"}
                except asyncio.CancelledError:
                    # Client disconnected
                    return

        finally:
            # Cleanup on disconnect
            async with self._lock:
                if queue in self._subscribers:
                    self._subscribers.remove(queue)


# Global buffer store with 30 minute TTL
_buffers: TTLCache[str, SessionEventBuffer] = TTLCache(maxsize=100, ttl=1800)


def get_buffer(session_id: str) -> SessionEventBuffer | None:
    """Get existing buffer for a session, or None if not found."""
    return _buffers.get(session_id)


def get_or_create_buffer(session_id: str) -> SessionEventBuffer:
    """Get or create a buffer for a session."""
    if session_id not in _buffers:
        _buffers[session_id] = SessionEventBuffer()
    return _buffers[session_id]


def create_new_buffer(session_id: str) -> SessionEventBuffer:
    """Create a fresh buffer for a session, replacing any existing one."""
    _buffers[session_id] = SessionEventBuffer()
    return _buffers[session_id]


def is_task_running(session_id: str) -> bool:
    """Check if there's an active (non-complete) task for the session."""
    buffer = _buffers.get(session_id)
    if buffer is None:
        return False
    return not buffer.is_complete and len(buffer.events) > 0

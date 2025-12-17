"""
Session event buffer for SSE stream resumption.

Simple polling-based approach: agent writes pre-serialized SSE strings to a list,
SSE streams poll the list for new events.
"""

import asyncio
import threading
from typing import AsyncIterator

from cachetools import TTLCache

# SSE format string
SSE_FORMAT = "data: {payload}\n\n"
SSE_KEEPALIVE = ": keepalive\n\n"


class SessionEventBuffer:
    """Buffer for storing and streaming pre-serialized SSE events."""

    def __init__(self):
        self.events: list[str] = []  # Pre-serialized SSE strings
        self.is_complete: bool = False
        self.is_started: bool = False  # Set to True when task starts
        self.error: str | None = None
        self._lock = threading.Lock()

    def append(self, sse_string: str) -> None:
        """Add a pre-serialized SSE string to the buffer."""
        with self._lock:
            self.events.append(sse_string)

    def clear(self) -> None:
        """Clear all events from the buffer after they've been saved to disk."""
        with self._lock:
            self.events.clear()

    def mark_complete(self, error: str | None = None) -> None:
        """Mark the buffer as complete (agent finished)."""
        self.is_complete = True
        self.error = error

    async def subscribe(
        self, since: int = 0, timeout: float = 300.0
    ) -> AsyncIterator[str]:
        """
        Yield SSE strings from the buffer, polling for new ones until complete.

        Args:
            since: Start from this event index (skip first N events)
            timeout: Max seconds to wait for new events (default 5 minutes)
        """
        last_index = since
        keepalive_counter = 0
        idle_counter = 0
        max_idle_iterations = int(timeout / 0.1)  # Convert timeout to iterations

        while True:
            # Yield any new events
            had_events = False
            while last_index < len(self.events):
                yield self.events[last_index]
                last_index += 1
                keepalive_counter = 0
                idle_counter = 0
                had_events = True

            # Done?
            if self.is_complete:
                return

            # Wait before checking again
            await asyncio.sleep(0.1)

            # Track idle time (no new events)
            if not had_events:
                idle_counter += 1
                # Timeout if no events for too long
                if idle_counter >= max_idle_iterations:
                    return

            # Send keepalive every ~30 seconds (300 * 0.1s)
            keepalive_counter += 1
            if keepalive_counter >= 300:
                yield SSE_KEEPALIVE
                keepalive_counter = 0


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
    buffer = SessionEventBuffer()
    buffer.is_started = True
    _buffers[session_id] = buffer
    return buffer


def is_task_running(session_id: str) -> bool:
    """Check if there's an active (non-complete) task for the session."""
    buffer = _buffers.get(session_id)
    if buffer is None:
        return False
    # Use is_started flag instead of events length since buffer gets cleared after disk saves
    return buffer.is_started and not buffer.is_complete

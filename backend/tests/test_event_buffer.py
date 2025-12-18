"""
Tests for SessionEventBuffer

These tests verify the event buffer correctly handles:
1. Basic append/subscribe operations
2. Concurrent producer/consumer scenarios
3. Edge cases

Note: The buffer no longer clears during streaming - it accumulates all events
for the task lifetime. This eliminates race conditions between producer and consumer.
"""

import asyncio

import pytest

from app.services.event_buffer import (
    SessionEventBuffer,
    create_new_buffer,
    get_buffer,
    is_task_running,
    _buffers,
)


@pytest.fixture
def clean_buffers():
    """Clean up global buffer store before/after each test"""
    _buffers.clear()
    yield
    _buffers.clear()


class TestBasicOperations:
    """Test basic buffer operations"""

    @pytest.mark.asyncio
    async def test_append_and_subscribe(self, clean_buffers):
        """Basic append and read"""
        buffer = SessionEventBuffer()
        buffer.append("event1")
        buffer.append("event2")
        buffer.append("event3")
        buffer.mark_complete()

        events = []
        async for event in buffer.subscribe():
            events.append(event)

        assert events == ["event1", "event2", "event3"]

    @pytest.mark.asyncio
    async def test_subscribe_since_offset(self, clean_buffers):
        """Skip first N events using since parameter"""
        buffer = SessionEventBuffer()
        buffer.append("event0")
        buffer.append("event1")
        buffer.append("event2")
        buffer.append("event3")
        buffer.mark_complete()

        events = []
        async for event in buffer.subscribe(since=2):
            events.append(event)

        assert events == ["event2", "event3"]

    @pytest.mark.asyncio
    async def test_mark_complete_ends_subscription(self, clean_buffers):
        """Stream ends when buffer is marked complete"""
        buffer = SessionEventBuffer()
        buffer.append("event1")

        async def delayed_complete():
            await asyncio.sleep(0.15)
            buffer.mark_complete()

        asyncio.create_task(delayed_complete())

        events = []
        async for event in buffer.subscribe(timeout=1.0):
            events.append(event)

        assert events == ["event1"]
        assert buffer.is_complete


class TestConcurrentAccess:
    """Test concurrent producer/consumer scenarios"""

    @pytest.mark.asyncio
    async def test_concurrent_append_and_subscribe(self, clean_buffers):
        """Producer appends while consumer reads"""
        buffer = SessionEventBuffer()
        events_received = []

        async def producer():
            for i in range(10):
                buffer.append(f"event{i}")
                await asyncio.sleep(0.02)
            buffer.mark_complete()

        async def consumer():
            async for event in buffer.subscribe(timeout=2.0):
                events_received.append(event)

        await asyncio.gather(producer(), consumer())

        expected = [f"event{i}" for i in range(10)]
        assert events_received == expected

    @pytest.mark.asyncio
    async def test_full_agent_event_sequence(self, clean_buffers):
        """Simulate the actual agent event sequence.

        Buffer accumulates all events - no clearing during streaming.
        """
        buffer = SessionEventBuffer()
        all_events_read = []

        async def producer():
            """Simulates agent yielding events"""
            # Turn 1: streaming
            buffer.append("turn_start_1")
            await asyncio.sleep(0.05)
            buffer.append("thought_1")
            await asyncio.sleep(0.05)
            buffer.append("text_delta_1")
            await asyncio.sleep(0.05)

            # Tool execution
            buffer.append("tool_call_1")
            await asyncio.sleep(0.05)
            buffer.append("tool_result_1")
            await asyncio.sleep(0.05)

            # Turn 2
            buffer.append("turn_start_2")
            await asyncio.sleep(0.05)
            buffer.append("complete")
            await asyncio.sleep(0.05)

            buffer.mark_complete()

        async def consumer():
            """Simulates frontend subscribing"""
            async for event in buffer.subscribe(timeout=2.0):
                all_events_read.append(event)

        # Run producer and consumer concurrently
        await asyncio.gather(producer(), consumer())

        # Should have received ALL events
        expected = [
            "turn_start_1",
            "thought_1",
            "text_delta_1",
            "tool_call_1",
            "tool_result_1",
            "turn_start_2",
            "complete",
        ]
        assert all_events_read == expected

    @pytest.mark.asyncio
    async def test_rapid_append_cycles(self, clean_buffers):
        """Rapid append cycles - all events should be received."""
        buffer = SessionEventBuffer()
        events_received = []
        total_events = 0

        async def producer():
            nonlocal total_events
            for cycle in range(5):
                for i in range(3):
                    event = f"cycle{cycle}_event{i}"
                    buffer.append(event)
                    total_events += 1
                    await asyncio.sleep(0.01)
            buffer.mark_complete()

        async def consumer():
            async for event in buffer.subscribe(timeout=2.0):
                events_received.append(event)

        await asyncio.gather(producer(), consumer())

        # Should receive all 15 events (5 cycles * 3 events)
        assert len(events_received) == total_events


class TestResumeScenario:
    """Test session resume scenarios"""

    @pytest.mark.asyncio
    async def test_resume_replays_all_events(self, clean_buffers):
        """On resume, subscriber with since=0 gets all buffered events."""
        buffer = SessionEventBuffer()

        # Simulate events that happened before resume
        buffer.append("turn_start")
        buffer.append("thought_1")
        buffer.append("tool_call_1")
        buffer.append("tool_result_1")
        buffer.mark_complete()

        # Resume subscriber gets everything
        events = []
        async for event in buffer.subscribe(since=0):
            events.append(event)

        assert events == ["turn_start", "thought_1", "tool_call_1", "tool_result_1"]

    @pytest.mark.asyncio
    async def test_resume_with_since_skips_already_processed(self, clean_buffers):
        """Resume with since > 0 skips already-processed events."""
        buffer = SessionEventBuffer()

        buffer.append("event0")
        buffer.append("event1")
        buffer.append("event2")
        buffer.append("event3")
        buffer.mark_complete()

        # Resume from index 2 (already processed 0 and 1)
        events = []
        async for event in buffer.subscribe(since=2):
            events.append(event)

        assert events == ["event2", "event3"]


class TestEdgeCases:
    """Test edge cases"""

    @pytest.mark.asyncio
    async def test_subscribe_to_empty_buffer_then_complete(self, clean_buffers):
        """Subscribe to empty buffer that immediately completes"""
        buffer = SessionEventBuffer()

        async def delayed_complete():
            await asyncio.sleep(0.1)
            buffer.mark_complete()

        asyncio.create_task(delayed_complete())

        events = []
        async for event in buffer.subscribe(timeout=1.0):
            events.append(event)

        assert events == []

    @pytest.mark.asyncio
    async def test_timeout_on_no_events(self, clean_buffers):
        """Subscription times out if no events and not complete"""
        buffer = SessionEventBuffer()

        events = []
        async for event in buffer.subscribe(timeout=0.3):
            events.append(event)

        assert events == []


class TestGlobalBufferFunctions:
    """Test module-level buffer management functions"""

    def test_create_new_buffer(self, clean_buffers):
        """create_new_buffer creates and registers a buffer"""
        buffer = create_new_buffer("session1")

        assert buffer.is_started is True
        assert get_buffer("session1") is buffer

    def test_is_task_running(self, clean_buffers):
        """is_task_running checks started and complete flags"""
        # No buffer
        assert is_task_running("session1") is False

        # Buffer created (started)
        buffer = create_new_buffer("session1")
        assert is_task_running("session1") is True

        # Buffer completed
        buffer.mark_complete()
        assert is_task_running("session1") is False

    def test_get_buffer_returns_none_for_unknown(self, clean_buffers):
        """get_buffer returns None for unknown session"""
        assert get_buffer("unknown") is None

    def test_create_new_buffer_replaces_existing(self, clean_buffers):
        """create_new_buffer replaces any existing buffer"""
        buffer1 = create_new_buffer("session1")
        buffer1.append("old_event")

        buffer2 = create_new_buffer("session1")

        assert get_buffer("session1") is buffer2
        assert len(buffer2.events) == 0  # Fresh buffer

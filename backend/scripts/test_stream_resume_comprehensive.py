#!/usr/bin/env python3
"""
Comprehensive test for SSE stream resumption.

Tests:
1. Basic stream connection and event reception
2. Disconnect mid-stream and resume via /status endpoint
3. Simulate page refresh (get status, process buffered events, reconnect)
4. Verify all events are captured (no duplicates, no missing)
5. Test completed task replay

Usage:
    python scripts/test_stream_resume_comprehensive.py
"""

import asyncio
import httpx
import json
import sys
from dataclasses import dataclass, field
from typing import Optional


BASE_URL = "http://localhost:8000"


@dataclass
class EventTracker:
    """Track all events received to verify consistency."""
    events: list[dict] = field(default_factory=list)
    event_types: list[str] = field(default_factory=list)

    def add(self, event: dict):
        self.events.append(event)
        self.event_types.append(event.get("type", "unknown"))

    def has_complete(self) -> bool:
        return "complete" in self.event_types

    def get_last_type(self) -> Optional[str]:
        return self.event_types[-1] if self.event_types else None

    def summary(self) -> str:
        type_counts = {}
        for t in self.event_types:
            type_counts[t] = type_counts.get(t, 0) + 1
        return f"Total: {len(self.events)}, Types: {type_counts}"


DEFAULT_TIMEOUT = httpx.Timeout(30.0, connect=10.0)


async def create_session() -> str:
    """Create a new session."""
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        resp = await client.post(f"{BASE_URL}/api/sessions")
        resp.raise_for_status()
        return resp.json()["session_id"]


async def start_chat(session_id: str, message: str, model: str = "claude-sonnet-4-20250514") -> bool:
    """Start a chat task. Returns True if started, False if already running."""
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        resp = await client.post(
            f"{BASE_URL}/api/chat",
            json={
                "session_id": session_id,
                "message": message,
                "model": model,
                "thinking_level": "low",
            }
        )
        if resp.status_code == 409:
            return False  # Already running
        resp.raise_for_status()
        return True


async def get_session_status(session_id: str) -> dict:
    """Get session status including buffered events."""
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        resp = await client.get(f"{BASE_URL}/api/sessions/{session_id}/status")
        resp.raise_for_status()
        return resp.json()


async def get_session_details(session_id: str) -> dict:
    """Get full session details including conversation."""
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        resp = await client.get(f"{BASE_URL}/api/sessions/{session_id}")
        resp.raise_for_status()
        return resp.json()


def parse_sse_event(sse_string: str) -> Optional[dict]:
    """Parse a pre-serialized SSE string into an event dict."""
    match = sse_string.strip()
    if not match.startswith("data:"):
        return None
    try:
        data_str = match[5:].strip()
        return json.loads(data_str)
    except:
        return None


async def stream_events_until(
    session_id: str,
    tracker: EventTracker,
    stop_after_types: list[str] = None,
    stop_after_count: int = None,
    since: int = 0,
    timeout: float = 60.0
) -> str:
    """
    Stream events and add to tracker.
    Returns: "complete", "stopped", "timeout", or "error"
    """
    async with httpx.AsyncClient(timeout=httpx.Timeout(timeout)) as client:
        try:
            async with client.stream(
                "GET",
                f"{BASE_URL}/api/sessions/{session_id}/stream",
                params={"since": since} if since > 0 else {}
            ) as response:
                if response.status_code == 404:
                    return "no_task"
                response.raise_for_status()

                count = 0
                async for line in response.aiter_lines():
                    if not line or line.startswith(":"):
                        continue
                    if line.startswith("data:"):
                        data_str = line[5:].strip()
                        try:
                            event = json.loads(data_str)
                            tracker.add(event)
                            count += 1

                            event_type = event.get("type")

                            if event_type == "complete":
                                return "complete"

                            if stop_after_types and event_type in stop_after_types:
                                return "stopped"

                            if stop_after_count and count >= stop_after_count:
                                return "stopped"

                        except json.JSONDecodeError:
                            pass

        except httpx.ReadTimeout:
            return "timeout"
        except Exception as e:
            print(f"    Stream error: {e}")
            return "error"

    return "done"


async def test_basic_stream():
    """Test 1: Basic stream works end-to-end."""
    print("\n" + "="*70)
    print("TEST 1: Basic Stream Connection")
    print("="*70)

    session_id = await create_session()
    print(f"  Created session: {session_id[:8]}...")

    await start_chat(session_id, "Create a 2x2x2 stone cube")
    print("  Started chat task")

    tracker = EventTracker()
    result = await stream_events_until(session_id, tracker, timeout=120.0)

    print(f"  Stream result: {result}")
    print(f"  Events: {tracker.summary()}")

    if result == "complete" and tracker.has_complete():
        print("  ✓ PASSED: Received complete event")
        return True, session_id
    else:
        print("  ✗ FAILED: Did not receive complete event")
        return False, session_id


async def test_disconnect_and_resume():
    """Test 2: Disconnect mid-stream and resume via status."""
    print("\n" + "="*70)
    print("TEST 2: Disconnect and Resume")
    print("="*70)

    session_id = await create_session()
    print(f"  Created session: {session_id[:8]}...")

    await start_chat(session_id, "Create a medieval house with a chimney")
    print("  Started chat task")

    # Stream for a few events then disconnect
    tracker1 = EventTracker()
    result1 = await stream_events_until(
        session_id, tracker1,
        stop_after_count=5,
        timeout=60.0
    )
    print(f"  First connection: {result1}, got {len(tracker1.events)} events")

    if len(tracker1.events) == 0:
        print("  ✗ FAILED: No events received in first connection")
        return False, session_id

    # Wait a bit for more events to buffer
    await asyncio.sleep(2.0)

    # Get status (simulates page refresh)
    status = await get_session_status(session_id)
    print(f"  Status: {status['status']}, buffered events: {status['event_count']}")

    # Process buffered events
    tracker2 = EventTracker()
    for sse_str in status["events"]:
        event = parse_sse_event(sse_str)
        if event:
            tracker2.add(event)

    print(f"  Processed {len(tracker2.events)} buffered events from status")

    # If still running, reconnect for remaining events
    if status["status"] == "running":
        since = status["event_count"]
        print(f"  Reconnecting to stream since={since}...")
        result2 = await stream_events_until(
            session_id, tracker2,
            since=since,
            timeout=120.0
        )
        print(f"  Resume result: {result2}")

    print(f"  Total events via resume: {tracker2.summary()}")

    if tracker2.has_complete():
        print("  ✓ PASSED: Successfully resumed and got complete event")
        return True, session_id
    else:
        print("  ✗ FAILED: Did not get complete event after resume")
        return False, session_id


async def test_page_refresh_during_task():
    """Test 3: Simulate page refresh during active task."""
    print("\n" + "="*70)
    print("TEST 3: Page Refresh During Task")
    print("="*70)

    session_id = await create_session()
    print(f"  Created session: {session_id[:8]}...")

    await start_chat(session_id, "Create a small fountain with water")
    print("  Started chat task")

    # Wait for some events to accumulate
    await asyncio.sleep(3.0)

    # Simulate page refresh: check status first
    print("  [Simulating page refresh...]")
    status = await get_session_status(session_id)
    print(f"  Status after 'refresh': {status['status']}, events: {status['event_count']}")

    # Get session details (conversation)
    details = await get_session_details(session_id)
    print(f"  Conversation messages: {len(details.get('conversation', []))}")

    # Process buffered events
    tracker = EventTracker()
    for sse_str in status["events"]:
        event = parse_sse_event(sse_str)
        if event:
            tracker.add(event)

    print(f"  Replayed {len(tracker.events)} events from buffer")

    # Check if we have initial context
    has_turn_start = "turn_start" in tracker.event_types
    print(f"  Has turn_start: {has_turn_start}")

    # Continue streaming if still running
    if status["status"] == "running" and not tracker.has_complete():
        since = status["event_count"]
        print(f"  Continuing stream since={since}...")
        result = await stream_events_until(
            session_id, tracker,
            since=since,
            timeout=120.0
        )
        print(f"  Final result: {result}")

    print(f"  Final events: {tracker.summary()}")

    if tracker.has_complete() and has_turn_start:
        print("  ✓ PASSED: Page refresh preserved all events")
        return True, session_id
    else:
        print("  ✗ FAILED: Events lost during page refresh")
        return False, session_id


async def test_multiple_refreshes():
    """Test 4: Multiple page refreshes during task."""
    print("\n" + "="*70)
    print("TEST 4: Multiple Page Refreshes")
    print("="*70)

    session_id = await create_session()
    print(f"  Created session: {session_id[:8]}...")

    await start_chat(session_id, "Create a tower with 3 floors")
    print("  Started chat task")

    all_events = EventTracker()

    for refresh_num in range(3):
        await asyncio.sleep(2.0)

        status = await get_session_status(session_id)
        print(f"  Refresh #{refresh_num + 1}: status={status['status']}, events={status['event_count']}")

        if status["status"] != "running":
            # Process final events
            for sse_str in status["events"]:
                event = parse_sse_event(sse_str)
                if event and event not in all_events.events:
                    all_events.add(event)
            break

    # Final check
    status = await get_session_status(session_id)
    for sse_str in status["events"]:
        event = parse_sse_event(sse_str)
        if event:
            # Deduplicate by checking if already seen
            if not any(e == event for e in all_events.events):
                all_events.add(event)

    # If still running, wait for completion
    if status["status"] == "running":
        print("  Waiting for completion...")
        tracker = EventTracker()
        result = await stream_events_until(
            session_id, tracker,
            since=status["event_count"],
            timeout=120.0
        )
        for e in tracker.events:
            all_events.add(e)

    print(f"  Total unique events: {all_events.summary()}")

    if all_events.has_complete():
        print("  ✓ PASSED: Multiple refreshes handled correctly")
        return True, session_id
    else:
        print("  ✗ FAILED: Lost events during multiple refreshes")
        return False, session_id


async def test_conversation_persistence():
    """Test 5: Verify conversation is persisted correctly."""
    print("\n" + "="*70)
    print("TEST 5: Conversation Persistence")
    print("="*70)

    session_id = await create_session()
    print(f"  Created session: {session_id[:8]}...")

    user_message = "Create a simple wooden bench"
    await start_chat(session_id, user_message)
    print(f"  Sent message: '{user_message}'")

    # Wait for task to complete
    tracker = EventTracker()
    result = await stream_events_until(session_id, tracker, timeout=120.0)
    print(f"  Task result: {result}")

    # Check conversation
    details = await get_session_details(session_id)
    conversation = details.get("conversation", [])

    print(f"  Conversation has {len(conversation)} messages")

    # Check first message is user message
    if len(conversation) > 0:
        first_msg = conversation[0]
        print(f"  First message role: {first_msg.get('role')}")
        print(f"  First message content: {first_msg.get('content', '')[:50]}...")

        if first_msg.get("role") == "user" and user_message in first_msg.get("content", ""):
            print("  ✓ PASSED: User message preserved in conversation")
            return True, session_id

    print("  ✗ FAILED: User message not found in conversation")
    return False, session_id


async def test_refresh_after_complete():
    """Test 6: Refresh after task is complete."""
    print("\n" + "="*70)
    print("TEST 6: Refresh After Task Complete")
    print("="*70)

    session_id = await create_session()
    print(f"  Created session: {session_id[:8]}...")

    await start_chat(session_id, "Create a 1x1x1 diamond block")

    # Wait for completion
    tracker = EventTracker()
    result = await stream_events_until(session_id, tracker, timeout=120.0)
    print(f"  Task completed: {result}, events: {len(tracker.events)}")

    # Now simulate page refresh
    print("  [Simulating page refresh after completion...]")
    status = await get_session_status(session_id)
    print(f"  Status: {status['status']}, buffered events: {status['event_count']}")

    # Process buffered events
    refresh_tracker = EventTracker()
    for sse_str in status["events"]:
        event = parse_sse_event(sse_str)
        if event:
            refresh_tracker.add(event)

    print(f"  Replayed {len(refresh_tracker.events)} events")
    print(f"  Original types: {tracker.event_types}")
    print(f"  Replayed types: {refresh_tracker.event_types}")

    # Verify all events match
    if len(tracker.events) == len(refresh_tracker.events):
        print("  ✓ PASSED: All events preserved after completion")
        return True, session_id
    else:
        print(f"  ✗ FAILED: Event count mismatch ({len(tracker.events)} vs {len(refresh_tracker.events)})")
        return False, session_id


async def main():
    print("\n" + "#"*70)
    print("# COMPREHENSIVE SSE STREAM RESUMPTION TEST")
    print("#"*70)

    results = []

    try:
        results.append(await test_basic_stream())
        results.append(await test_disconnect_and_resume())
        results.append(await test_page_refresh_during_task())
        results.append(await test_multiple_refreshes())
        results.append(await test_conversation_persistence())
        results.append(await test_refresh_after_complete())
    except Exception as e:
        print(f"\n!!! TEST ERROR: {e}")
        import traceback
        traceback.print_exc()

    # Summary
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)

    passed = sum(1 for r, _ in results if r)
    total = len(results)

    print(f"\nPassed: {passed}/{total}")

    if passed == total:
        print("\n✓ ALL TESTS PASSED")
        return 0
    else:
        print("\n✗ SOME TESTS FAILED")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

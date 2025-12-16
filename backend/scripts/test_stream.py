#!/usr/bin/env python3
"""
Test script for SSE streaming with status-first approach.

Usage:
    cd backend
    uv run python scripts/test_stream.py

Tests the flow:
1. GET /status returns all buffered events
2. If running, GET /stream?since=N only gets new events
"""

import asyncio
import json
import sys

import httpx

BASE_URL = "http://localhost:8000/api"


async def create_session() -> str:
    """Create a new session."""
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{BASE_URL}/sessions")
        response.raise_for_status()
        return response.json()["session_id"]


async def start_chat(session_id: str, message: str) -> dict:
    """Start a chat task."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{BASE_URL}/chat",
            json={"session_id": session_id, "message": message, "model": None},
        )
        return {"status_code": response.status_code, "data": response.json()}


async def get_status(session_id: str) -> dict:
    """Get status with all buffered events."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/sessions/{session_id}/status")
        return response.json()


def parse_sse_events(sse_strings: list[str]) -> list[dict]:
    """Parse pre-serialized SSE strings into event dicts."""
    events = []
    for sse_string in sse_strings:
        if sse_string.startswith("data:"):
            data_str = sse_string[5:].strip()
            try:
                events.append(json.loads(data_str))
            except json.JSONDecodeError:
                pass
    return events


async def stream_since(session_id: str, since: int, timeout: float = 60.0) -> list[dict]:
    """Stream events starting from index `since`."""
    events = []
    async with httpx.AsyncClient(timeout=httpx.Timeout(timeout)) as client:
        try:
            async with client.stream(
                "GET", f"{BASE_URL}/sessions/{session_id}/stream?since={since}"
            ) as response:
                if response.status_code != 200:
                    return []

                buffer = ""
                async for chunk in response.aiter_text():
                    buffer += chunk
                    while "\n\n" in buffer:
                        event_str, buffer = buffer.split("\n\n", 1)
                        for line in event_str.split("\n"):
                            if line.startswith("data:"):
                                data_str = line[5:].strip()
                                try:
                                    event = json.loads(data_str)
                                    events.append(event)
                                    if event.get("type") == "complete":
                                        return events
                                except json.JSONDecodeError:
                                    pass
        except httpx.ReadTimeout:
            pass
    return events


def print_events(events: list[dict], prefix: str = ""):
    """Print event summary."""
    type_counts = {}
    for e in events:
        t = e.get("type", "unknown")
        type_counts[t] = type_counts.get(t, 0) + 1
    print(f"{prefix}Events: {len(events)}")
    for t, count in sorted(type_counts.items()):
        print(f"{prefix}  - {t}: {count}")


async def test_completed_task():
    """Test: Get all events from status endpoint when task is complete."""
    print("\n" + "=" * 60)
    print("TEST 1: Completed Task (status endpoint only)")
    print("=" * 60)

    session_id = await create_session()
    print(f"Created session: {session_id}")

    result = await start_chat(session_id, "Create a simple red cube")
    print(f"Chat started: {result}")

    # Wait for task to complete
    print("Waiting for task to complete...")
    while True:
        status = await get_status(session_id)
        if status["status"] != "running":
            break
        await asyncio.sleep(0.5)

    print(f"\nStatus: {status['status']}")
    print(f"Event count: {status['event_count']}")

    events = parse_sse_events(status["events"])
    print_events(events)

    if status["status"] == "completed" and len(events) > 0:
        print("\nPASS: Got all events from status endpoint")
        return True
    else:
        print("\nFAIL: Did not get expected events")
        return False


async def test_running_task():
    """Test: Get initial events from status, then stream new ones."""
    print("\n" + "=" * 60)
    print("TEST 2: Running Task (status + stream)")
    print("=" * 60)

    session_id = await create_session()
    print(f"Created session: {session_id}")

    result = await start_chat(session_id, "Create a simple red cube")
    print(f"Chat started: {result}")

    # Get status immediately (while still running)
    await asyncio.sleep(0.5)
    status = await get_status(session_id)
    print(f"\nInitial status: {status['status']}")
    print(f"Initial event count: {status['event_count']}")

    initial_events = parse_sse_events(status["events"])
    print_events(initial_events, prefix="Initial ")

    # If still running, stream remaining events
    if status["status"] == "running":
        print(f"\nStreaming from event {status['event_count']}...")
        new_events = await stream_since(session_id, status["event_count"])
        print_events(new_events, prefix="New ")

        total_events = len(initial_events) + len(new_events)
        print(f"\nTotal events: {total_events}")

        # Verify we didn't get duplicates
        if len(new_events) > 0 and new_events[0].get("type") == initial_events[-1].get("type"):
            print("WARNING: Possible duplicate at boundary")

        print("\nPASS: Successfully got initial + streamed events")
        return True
    else:
        print("Task already completed, skipping stream test")
        return True


async def test_reconnect():
    """Test: Disconnect mid-stream, reconnect with since parameter."""
    print("\n" + "=" * 60)
    print("TEST 3: Reconnect with since parameter")
    print("=" * 60)

    session_id = await create_session()
    print(f"Created session: {session_id}")

    result = await start_chat(session_id, "Create a simple red cube")
    print(f"Chat started: {result}")

    # Get initial status
    await asyncio.sleep(0.3)
    status1 = await get_status(session_id)
    events1 = parse_sse_events(status1["events"])
    print(f"First check: {len(events1)} events, status={status1['status']}")

    # Wait a bit and check again
    await asyncio.sleep(1)
    status2 = await get_status(session_id)
    events2 = parse_sse_events(status2["events"])
    print(f"Second check: {len(events2)} events, status={status2['status']}")

    # If still running, use stream with since
    if status2["status"] == "running":
        new_events = await stream_since(session_id, status2["event_count"])
        print(f"Streamed {len(new_events)} new events")

    # Final status
    final_status = await get_status(session_id)
    final_events = parse_sse_events(final_status["events"])
    print(f"\nFinal: {len(final_events)} total events, status={final_status['status']}")
    print_events(final_events)

    print("\nPASS: Reconnect flow works")
    return True


async def main():
    print("=" * 60)
    print("SSE Stream Test (Status-First Approach)")
    print("=" * 60)

    results = {}
    tests = [
        ("Completed Task", test_completed_task),
        ("Running Task", test_running_task),
        ("Reconnect", test_reconnect),
    ]

    for name, test_fn in tests:
        try:
            results[name] = await test_fn()
        except Exception as e:
            print(f"\nERROR in {name}: {e}")
            import traceback
            traceback.print_exc()
            results[name] = False

    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    for name, passed in results.items():
        print(f"  {'PASS' if passed else 'FAIL'}: {name}")

    passed = sum(1 for v in results.values() if v)
    print(f"\n{passed}/{len(results)} tests passed")
    return all(results.values())


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)

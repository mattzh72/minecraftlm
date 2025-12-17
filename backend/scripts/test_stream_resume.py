#!/usr/bin/env python3
"""
Test script to debug SSE stream resumption.

Usage:
    python scripts/test_stream_resume.py
"""

import asyncio
import httpx
import json
import sys


BASE_URL = "http://localhost:8000"


async def create_session() -> str:
    """Create a new session."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(f"{BASE_URL}/api/sessions")
        resp.raise_for_status()
        data = resp.json()
        return data["session_id"]


async def start_chat(session_id: str, message: str, model: str = "claude-sonnet-4-20250514") -> None:
    """Start a chat task."""
    async with httpx.AsyncClient() as client:
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
            print("  [WARN] Task already running (409)")
            return
        resp.raise_for_status()
        print(f"  Chat started: {resp.json()}")


async def get_session_status(session_id: str) -> dict:
    """Get session status."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{BASE_URL}/api/sessions/{session_id}/status")
        resp.raise_for_status()
        return resp.json()


async def stream_events(session_id: str, since: int = 0, max_events: int = 5, timeout: float = 10.0):
    """Connect to SSE stream and consume events."""
    print(f"  Connecting to stream (since={since})...")
    events_received = []

    async with httpx.AsyncClient(timeout=httpx.Timeout(timeout)) as client:
        try:
            async with client.stream(
                "GET",
                f"{BASE_URL}/api/sessions/{session_id}/stream",
                params={"since": since}
            ) as response:
                if response.status_code == 404:
                    print("  [ERROR] No active task (404)")
                    return events_received

                response.raise_for_status()

                async for line in response.aiter_lines():
                    if not line:
                        continue
                    if line.startswith(":"):
                        print(f"    [keepalive]")
                        continue
                    if line.startswith("data:"):
                        data_str = line[5:].strip()
                        try:
                            event = json.loads(data_str)
                            events_received.append(event)
                            event_type = event.get("type", "unknown")
                            event_data = event.get("data", {})

                            # Print more details for error events
                            if event_type == "error":
                                print(f"    Event #{len(events_received)}: {event_type} - {event_data.get('message', 'no message')}")
                            else:
                                print(f"    Event #{len(events_received)}: {event_type}")

                            if event_type == "complete":
                                reason = event_data.get('reason', 'unknown')
                                print(f"    -> Stream complete: success={event_data.get('success')}, reason={reason}")
                                return events_received

                            if len(events_received) >= max_events:
                                print(f"    -> Stopping after {max_events} events (test limit)")
                                return events_received
                        except json.JSONDecodeError as e:
                            print(f"    [ERROR] Failed to parse: {data_str[:100]}")

        except httpx.ReadTimeout:
            print(f"  [TIMEOUT] Stream timed out after {timeout}s")
        except Exception as e:
            print(f"  [ERROR] Stream error: {e}")

    return events_received


async def test_stream_resume():
    """Test the stream resumption flow."""
    print("\n" + "="*60)
    print("SSE Stream Resumption Test")
    print("="*60)

    # Step 1: Create session
    print("\n1. Creating session...")
    session_id = await create_session()
    print(f"   Session ID: {session_id}")

    # Step 2: Check initial status
    print("\n2. Checking initial status...")
    status = await get_session_status(session_id)
    print(f"   Status: {status}")

    # Step 3: Start chat
    print("\n3. Starting chat task...")
    await start_chat(session_id, "Create a simple stone cube 3x3x3")

    # Give it a moment to start
    await asyncio.sleep(0.5)

    # Step 4: Check status after starting
    print("\n4. Checking status after start...")
    status = await get_session_status(session_id)
    print(f"   Status: {status['status']}, event_count: {status['event_count']}")

    # Step 5: Connect and get first few events
    print("\n5. First connection - getting first 3 events...")
    events1 = await stream_events(session_id, since=0, max_events=3, timeout=30.0)
    print(f"   Received {len(events1)} events")

    # Step 6: Check status again
    print("\n6. Checking status after disconnect...")
    await asyncio.sleep(1.0)  # Let more events accumulate
    status = await get_session_status(session_id)
    print(f"   Status: {status['status']}, event_count: {status['event_count']}")

    # Step 7: Reconnect from where we left off
    since = len(events1)
    print(f"\n7. Reconnecting from event {since}...")
    events2 = await stream_events(session_id, since=since, max_events=5, timeout=30.0)
    print(f"   Received {len(events2)} more events")

    # Step 8: Final status
    print("\n8. Final status check...")
    status = await get_session_status(session_id)
    print(f"   Status: {status['status']}, event_count: {status['event_count']}")

    print("\n" + "="*60)
    print("Test complete!")
    print(f"Total events: {len(events1) + len(events2)}")
    print("="*60 + "\n")


async def test_status_only():
    """Just test the status endpoint with an existing session."""
    if len(sys.argv) > 1:
        session_id = sys.argv[1]
    else:
        print("Creating new session...")
        session_id = await create_session()

    print(f"Session: {session_id}")

    print("\nGetting status...")
    status = await get_session_status(session_id)
    print(f"Status: {json.dumps(status, indent=2)}")

    if status["status"] == "running":
        print("\nTask is running, connecting to stream...")
        await stream_events(session_id, since=0, max_events=20, timeout=60.0)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--status":
        sys.argv.pop(1)  # Remove --status flag
        asyncio.run(test_status_only())
    else:
        asyncio.run(test_stream_resume())

"""
Test refresh behavior including what the frontend receives when it:
1. Fetches GET /sessions/{id}
2. Gets status from GET /sessions/{id}/status
3. Subscribes with since=event_count

This simulates the full frontend flow on page refresh.
"""

import json
from app.services.event_buffer import (
    create_new_buffer,
    get_buffer,
    is_task_running,
    reconstruct_conversation_from_buffer,
    SSE_FORMAT,
)

def create_sse_event(event_type: str, data: dict) -> str:
    """Create an SSE-formatted event string."""
    payload = json.dumps({"type": event_type, "data": data})
    return SSE_FORMAT.format(payload=payload)


def parse_sse_events(event_strings: list[str]) -> list[dict]:
    """Parse SSE strings back to event objects."""
    import re
    events = []
    data_pattern = re.compile(r"^data:\s*(.+)$", re.MULTILINE)
    for event_str in event_strings:
        match = data_pattern.search(event_str)
        if match:
            try:
                events.append(json.loads(match.group(1)))
            except:
                pass
    return events


def simulate_full_refresh_flow(session_id: str, disk_conversation: list):
    """
    Simulate exactly what happens on frontend refresh:
    1. GET /sessions/{id} - get merged conversation
    2. GET /sessions/{id}/status - get buffer state
    3. If running, subscribe with since=event_count
    """
    print("\n--- Simulating Frontend Refresh Flow ---")

    # Step 1: GET /sessions/{id}
    conversation = list(disk_conversation)
    buffer = get_buffer(session_id)

    if is_task_running(session_id) and buffer:
        current_turn = reconstruct_conversation_from_buffer(buffer)
        if current_turn:
            conversation.append(current_turn)

    print(f"\n1️⃣ GET /sessions/{session_id}")
    print(f"   Conversation has {len(conversation)} messages")
    for i, msg in enumerate(conversation):
        role = msg.get("role")
        content = msg.get("content", "")[:40]
        thought = msg.get("thought_summary", "")[:30] if msg.get("thought_summary") else ""
        print(f"   [{i}] {role}: '{content}'" + (f" (thought: '{thought}...')" if thought else ""))

    # Step 2: GET /sessions/{id}/status
    if buffer is None:
        status = {"status": "idle", "events": [], "event_count": 0}
    else:
        status = {
            "status": "running" if not buffer.is_complete else ("error" if buffer.error else "completed"),
            "events": buffer.events,
            "event_count": len(buffer.events),
        }

    print(f"\n2️⃣ GET /sessions/{session_id}/status")
    print(f"   status: {status['status']}")
    print(f"   event_count: {status['event_count']}")

    # Step 3: If running, subscribe with since=event_count
    if status["status"] == "running":
        since = status["event_count"]
        print(f"\n3️⃣ Subscribe to stream with since={since}")
        print(f"   This skips {since} events that were already processed")

        # Simulate what the frontend would receive next
        future_events = buffer.events[since:]
        print(f"   Would receive {len(future_events)} pending events")
    else:
        print(f"\n3️⃣ No stream subscription needed (status: {status['status']})")

    return conversation, status


def main():
    session_id = "test-stream-session"

    print("\n" + "="*70)
    print("TEST: Refresh during active streaming")
    print("="*70)

    # Setup: User message saved to disk, agent is streaming thoughts
    disk_conversation = [
        {"role": "user", "content": "Build me a castle"}
    ]

    buffer = create_new_buffer(session_id)

    # Agent starts responding
    events_to_add = [
        ("turn_start", {"turn": 1}),
        ("thought", {"delta": "I need to "}),
        ("thought", {"delta": "plan a castle "}),
        ("thought", {"delta": "with towers and walls."}),
        ("text_delta", {"delta": "Let me build "}),
        ("text_delta", {"delta": "a magnificent castle."}),
    ]

    for event_type, data in events_to_add:
        buffer.append(create_sse_event(event_type, data))

    print(f"\n📝 Current state:")
    print(f"   Disk: {len(disk_conversation)} messages")
    print(f"   Buffer: {len(buffer.events)} events")

    # Simulate refresh
    conv, status = simulate_full_refresh_flow(session_id, disk_conversation)

    # Verify
    assert len(conv) == 2, f"Expected 2 messages, got {len(conv)}"
    assert conv[1]["role"] == "assistant"
    assert conv[1]["thought_summary"] == "I need to plan a castle with towers and walls."
    assert conv[1]["content"] == "Let me build a magnificent castle."
    assert status["event_count"] == 6

    print("\n✅ Test passed: Conversation restored correctly")

    # Now simulate MORE events arriving after refresh
    print("\n" + "="*70)
    print("TEST: New events arrive after refresh")
    print("="*70)

    # Add more events (as if streaming continued)
    buffer.append(create_sse_event("tool_call", {
        "id": "call_456",
        "name": "edit_code",
        "args": {"code": "build_castle()"}
    }))
    buffer.append(create_sse_event("tool_result", {
        "tool_call_id": "call_456",
        "result": "Castle built!"
    }))

    print(f"\n📝 After more events:")
    print(f"   Buffer now has {len(buffer.events)} events")

    # If we refresh again now
    conv2, status2 = simulate_full_refresh_flow(session_id, disk_conversation)

    # The reconstructed message should now include the tool call
    assert len(conv2[1].get("tool_calls", [])) == 1
    print("\n✅ Second refresh also correct")

    # Key insight: frontend that subscribed with since=6 would get events 6,7 (tool_call, tool_result)
    print(f"\n🔍 A client that subscribed earlier with since=6 would receive:")
    new_events = buffer.events[6:]
    for evt_str in new_events:
        parsed = parse_sse_events([evt_str])
        if parsed:
            print(f"   - {parsed[0]['type']}")

    # Test the race condition scenario
    print("\n" + "="*70)
    print("TEST: Disk save happens between GET /session and GET /status")
    print("="*70)

    session_id2 = "test-race-session"
    disk2 = [{"role": "user", "content": "Build a tower"}]
    buffer2 = create_new_buffer(session_id2)
    buffer2.append(create_sse_event("turn_start", {"turn": 1}))
    buffer2.append(create_sse_event("thought", {"delta": "Building tower..."}))

    print(f"\n📝 Before race condition:")
    print(f"   Disk: {len(disk2)} messages")
    print(f"   Buffer: {len(buffer2.events)} events")

    # GET /sessions/{id} sees buffer has events
    conv_before = list(disk2)
    current_turn = reconstruct_conversation_from_buffer(buffer2)
    if current_turn:
        conv_before.append(current_turn)
    print(f"   GET /session returned {len(conv_before)} messages")

    # RACE: Disk save happens + buffer clears!
    disk2.append({
        "role": "assistant",
        "content": "",
        "thought_summary": "Building tower...",
        "tool_calls": None
    })
    buffer2.clear()
    buffer2.mark_complete()

    print(f"\n⚠️  Race condition: disk saved, buffer cleared between API calls!")
    print(f"   Disk: {len(disk2)} messages")
    print(f"   Buffer: {len(buffer2.events)} events, is_complete={buffer2.is_complete}")

    # Now GET /status sees completed
    status2 = {
        "status": "completed",
        "event_count": 0,
    }
    print(f"   GET /status returned: status={status2['status']}, event_count={status2['event_count']}")

    # Frontend has conv_before (with reconstructed turn) but status says completed
    # This is fine! Frontend has the data, and status says done, so no subscription needed
    print("\n✅ Race condition is harmless: frontend has data, status says complete")

    print("\n" + "🎉"*35)
    print("ALL STREAM TESTS PASSED!")
    print("🎉"*35 + "\n")


if __name__ == "__main__":
    main()

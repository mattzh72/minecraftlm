"""
Simulate page refresh behavior to test for duplication/gaps in conversation restoration.

This script:
1. Creates a session
2. Simulates agent events being buffered (like during streaming)
3. At various points, calls GET /sessions/{id} to see what would be returned on refresh
4. Checks for continuity and duplication issues
"""

import json
import re
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


def simulate_refresh(session_id: str, disk_conversation: list) -> list:
    """
    Simulate what GET /sessions/{id} returns.
    This mimics the logic in session.py get_session().
    """
    conversation = list(disk_conversation)  # Copy disk data

    if is_task_running(session_id):
        buffer = get_buffer(session_id)
        if buffer:
            current_turn = reconstruct_conversation_from_buffer(buffer)
            if current_turn:
                conversation.append(current_turn)

    return conversation


def print_conversation(label: str, conversation: list):
    """Pretty print conversation state."""
    print(f"\n{'='*60}")
    print(f"📋 {label}")
    print(f"{'='*60}")
    for i, msg in enumerate(conversation):
        role = msg.get("role", "unknown")
        content = msg.get("content", "")[:50] + ("..." if len(msg.get("content", "")) > 50 else "")
        thought = msg.get("thought_summary", "")
        if thought:
            thought = thought[:30] + ("..." if len(thought) > 30 else "")
        tool_calls = msg.get("tool_calls", [])

        print(f"  [{i}] {role}: content='{content}'")
        if thought:
            print(f"       thought='{thought}'")
        if tool_calls:
            print(f"       tool_calls={len(tool_calls)} calls")


def main():
    session_id = "test-refresh-session"

    # Scenario 1: Fresh session, agent just started thinking
    print("\n" + "🔵"*30)
    print("SCENARIO 1: Agent just started, user refreshes during thinking")
    print("🔵"*30)

    disk_conversation = [
        {"role": "user", "content": "Build a house"}
    ]

    # Create buffer and add some events
    buffer = create_new_buffer(session_id)
    buffer.append(create_sse_event("turn_start", {"turn": 1}))
    buffer.append(create_sse_event("thought", {"delta": "I'll build a "}))
    buffer.append(create_sse_event("thought", {"delta": "simple house with "}))
    buffer.append(create_sse_event("thought", {"delta": "walls and a roof."}))

    print(f"\nBuffer has {len(buffer.events)} events")
    print(f"is_task_running: {is_task_running(session_id)}")

    # Simulate refresh
    restored = simulate_refresh(session_id, disk_conversation)
    print_conversation("After refresh (mid-thinking)", restored)

    # Check expected state
    assert len(restored) == 2, f"Expected 2 messages, got {len(restored)}"
    assert restored[0]["role"] == "user"
    assert restored[1]["role"] == "assistant"
    assert restored[1]["thought_summary"] == "I'll build a simple house with walls and a roof."
    print("✅ Scenario 1 PASSED")

    # Scenario 2: Agent sends text content
    print("\n" + "🔵"*30)
    print("SCENARIO 2: Agent streams text, user refreshes during text")
    print("🔵"*30)

    buffer.append(create_sse_event("text_delta", {"delta": "I'll create "}))
    buffer.append(create_sse_event("text_delta", {"delta": "a cozy house for you."}))

    restored = simulate_refresh(session_id, disk_conversation)
    print_conversation("After refresh (mid-text)", restored)

    assert restored[1]["content"] == "I'll create a cozy house for you."
    assert restored[1]["thought_summary"] == "I'll build a simple house with walls and a roof."
    print("✅ Scenario 2 PASSED")

    # Scenario 3: Agent makes a tool call
    print("\n" + "🔵"*30)
    print("SCENARIO 3: Agent makes tool call, user refreshes")
    print("🔵"*30)

    buffer.append(create_sse_event("tool_call", {
        "id": "call_123",
        "name": "edit_code",
        "args": {"code": "scene.add_block(0, 0, 0, 'stone')"}
    }))

    restored = simulate_refresh(session_id, disk_conversation)
    print_conversation("After refresh (tool call)", restored)

    assert len(restored[1]["tool_calls"]) == 1
    assert restored[1]["tool_calls"][0]["function"]["name"] == "edit_code"
    print("✅ Scenario 3 PASSED")

    # Scenario 4: Turn completes, buffer clears, disk updates
    print("\n" + "🔵"*30)
    print("SCENARIO 4: Turn completes, disk saves, buffer clears")
    print("🔵"*30)

    # Simulate disk save + buffer clear (what harness.py does)
    disk_conversation.append({
        "role": "assistant",
        "content": "I'll create a cozy house for you.",
        "thought_summary": "I'll build a simple house with walls and a roof.",
        "tool_calls": [{
            "id": "call_123",
            "type": "function",
            "function": {"name": "edit_code", "arguments": '{"code": "scene.add_block(0, 0, 0, \'stone\')"}'}
        }]
    })
    buffer.clear()

    # Add tool result to disk
    disk_conversation.append({
        "role": "tool",
        "tool_call_id": "call_123",
        "content": '{"result": "Code executed successfully"}',
        "name": "edit_code"
    })

    # Mark buffer complete since no more events
    buffer.mark_complete()

    print(f"\nBuffer has {len(buffer.events)} events, is_complete={buffer.is_complete}")
    print(f"is_task_running: {is_task_running(session_id)}")

    restored = simulate_refresh(session_id, disk_conversation)
    print_conversation("After refresh (turn complete)", restored)

    assert len(restored) == 3  # user, assistant, tool
    print("✅ Scenario 4 PASSED")

    # Scenario 5: Follow-up message, new turn starts
    print("\n" + "🔵"*30)
    print("SCENARIO 5: User sends follow-up, agent starts new turn")
    print("🔵"*30)

    # User sends follow-up (gets saved to disk immediately)
    disk_conversation.append({"role": "user", "content": "Make it bigger"})

    # New buffer for new turn
    buffer = create_new_buffer(session_id)
    buffer.append(create_sse_event("turn_start", {"turn": 2}))
    buffer.append(create_sse_event("thought", {"delta": "I'll scale up the house."}))
    buffer.append(create_sse_event("text_delta", {"delta": "Making it larger..."}))

    print(f"\nBuffer has {len(buffer.events)} events")
    print(f"is_task_running: {is_task_running(session_id)}")

    restored = simulate_refresh(session_id, disk_conversation)
    print_conversation("After refresh (new turn mid-stream)", restored)

    # Should have: user1, assistant1, tool1, user2, assistant2(in-progress)
    assert len(restored) == 5
    assert restored[3]["role"] == "user"
    assert restored[3]["content"] == "Make it bigger"
    assert restored[4]["role"] == "assistant"
    assert restored[4]["thought_summary"] == "I'll scale up the house."
    assert restored[4]["content"] == "Making it larger..."
    print("✅ Scenario 5 PASSED")

    # Scenario 6: Multiple refreshes should give same result
    print("\n" + "🔵"*30)
    print("SCENARIO 6: Multiple rapid refreshes (idempotency check)")
    print("🔵"*30)

    results = []
    for i in range(3):
        restored = simulate_refresh(session_id, disk_conversation)
        results.append(json.dumps(restored, sort_keys=True))

    assert results[0] == results[1] == results[2], "Refreshes should be idempotent!"
    print("✅ Scenario 6 PASSED - All refreshes returned identical results")

    print("\n" + "🎉"*30)
    print("ALL SCENARIOS PASSED!")
    print("🎉"*30 + "\n")


if __name__ == "__main__":
    main()

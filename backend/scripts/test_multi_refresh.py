"""
Simulate an agent streaming with multiple page refreshes at different times.
Logs exactly what the frontend would see after each refresh.

This accurately simulates the harness behavior:
- User message saved to disk immediately
- Buffer cleared after user message save
- Assistant message saved after streaming complete (before tool execution)
- Tool responses saved after execution
- Buffer cleared after each save
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


def simulate_refresh(session_id: str, disk_conversation: list) -> tuple[list, dict]:
    """Simulate GET /session + GET /status calls."""
    conversation = list(disk_conversation)

    buffer = get_buffer(session_id)
    if is_task_running(session_id) and buffer:
        current_turn = reconstruct_conversation_from_buffer(buffer)
        if current_turn:
            conversation.append(current_turn)

    if buffer is None:
        status = {"status": "idle", "event_count": 0}
    else:
        status = {
            "status": "running" if not buffer.is_complete else ("error" if buffer.error else "completed"),
            "event_count": len(buffer.events),
        }

    return conversation, status


def log_refresh(refresh_num, conversation: list, status: dict):
    """Log the state after a refresh."""
    print(f"\n{'─'*60}")
    print(f"🔄 REFRESH #{refresh_num}")
    print(f"{'─'*60}")
    print(f"Status: {status['status']}, event_count: {status['event_count']}")
    print(f"Conversation ({len(conversation)} messages):")

    for i, msg in enumerate(conversation):
        role = msg.get("role")
        content = msg.get("content", "")
        thought = msg.get("thought_summary", "")
        tool_calls = msg.get("tool_calls", [])

        if role == "user":
            print(f"  [{i}] USER: {content}")
        elif role == "assistant":
            if thought:
                print(f"  [{i}] ASSISTANT thought: \"{thought[:60]}{'...' if len(thought) > 60 else ''}\"")
            if content:
                print(f"  [{i}] ASSISTANT content: \"{content[:60]}{'...' if len(content) > 60 else ''}\"")
            if tool_calls:
                for tc in tool_calls:
                    name = tc.get("function", {}).get("name", "unknown")
                    print(f"  [{i}] ASSISTANT tool_call: {name}")
        elif role == "tool":
            print(f"  [{i}] TOOL: {msg.get('name', 'unknown')}")


def main():
    session_id = "multi-refresh-test"

    print("="*60)
    print("MULTI-REFRESH SIMULATION (Accurate Harness Behavior)")
    print("="*60)

    # ============================================================
    # PHASE 1: User sends message, saved to disk immediately
    # ============================================================
    print("\n📝 PHASE 1: User sends message")
    disk_conversation = [{"role": "user", "content": "Build me a medieval castle"}]
    buffer = create_new_buffer(session_id)
    # In harness: buffer.clear() after save_conversation
    # But buffer was just created, so it's empty anyway

    conv, status = simulate_refresh(session_id, disk_conversation)
    log_refresh(1, conv, status)

    # ============================================================
    # PHASE 2: Agent starts thinking (turn_start + thoughts)
    # ============================================================
    print("\n📝 PHASE 2: Agent starts thinking")
    buffer.append(create_sse_event("turn_start", {"turn": 1}))
    buffer.append(create_sse_event("thought", {"delta": "I need to design "}))
    buffer.append(create_sse_event("thought", {"delta": "a castle with towers and walls."}))

    conv, status = simulate_refresh(session_id, disk_conversation)
    log_refresh(2, conv, status)

    # ============================================================
    # PHASE 3: Agent streams text
    # ============================================================
    print("\n📝 PHASE 3: Agent streams text")
    buffer.append(create_sse_event("text_delta", {"delta": "I'll create "}))
    buffer.append(create_sse_event("text_delta", {"delta": "a medieval castle for you."}))

    conv, status = simulate_refresh(session_id, disk_conversation)
    log_refresh(3, conv, status)

    # ============================================================
    # PHASE 4: Agent emits tool call
    # ============================================================
    print("\n📝 PHASE 4: Agent emits tool call")
    buffer.append(create_sse_event("tool_call", {"id": "call_1", "name": "edit_code", "args": {"code": "build()"}}))

    conv, status = simulate_refresh(session_id, disk_conversation)
    log_refresh(4, conv, status)

    # ============================================================
    # PHASE 5: LLM response complete - SAVE ASSISTANT MESSAGE TO DISK
    # This happens BEFORE tool execution in harness
    # ============================================================
    print("\n📝 PHASE 5: Assistant message saved to disk (before tool exec)")
    # Harness saves assistant message
    disk_conversation.append({
        "role": "assistant",
        "content": "I'll create a medieval castle for you.",
        "thought_summary": "I need to design a castle with towers and walls.",
        "tool_calls": [{
            "id": "call_1",
            "type": "function",
            "function": {"name": "edit_code", "arguments": '{"code": "build()"}'}
        }]
    })
    # Harness clears buffer after save
    buffer.clear()

    conv, status = simulate_refresh(session_id, disk_conversation)
    log_refresh(5, conv, status)

    # ============================================================
    # PHASE 6: Tool executes, result emitted
    # ============================================================
    print("\n📝 PHASE 6: Tool execution")
    buffer.append(create_sse_event("tool_result", {"tool_call_id": "call_1", "result": "Code executed"}))

    # Note: tool_result doesn't get reconstructed since we don't track it in reconstruct_conversation_from_buffer
    conv, status = simulate_refresh(session_id, disk_conversation)
    log_refresh(6, conv, status)

    # ============================================================
    # PHASE 7: Tool responses saved to disk
    # ============================================================
    print("\n📝 PHASE 7: Tool responses saved to disk")
    disk_conversation.append({
        "role": "tool",
        "tool_call_id": "call_1",
        "content": '{"result": "Code executed"}',
        "name": "edit_code"
    })
    buffer.clear()

    conv, status = simulate_refresh(session_id, disk_conversation)
    log_refresh(7, conv, status)

    # ============================================================
    # PHASE 8: Agent's second turn (more thinking + complete_task)
    # ============================================================
    print("\n📝 PHASE 8: Agent's second turn")
    buffer.append(create_sse_event("turn_start", {"turn": 2}))
    buffer.append(create_sse_event("thought", {"delta": "Let me verify the structure."}))
    buffer.append(create_sse_event("tool_call", {"id": "call_2", "name": "complete_task", "args": {}}))

    conv, status = simulate_refresh(session_id, disk_conversation)
    log_refresh(8, conv, status)

    # ============================================================
    # PHASE 9: Second assistant turn saved
    # ============================================================
    print("\n📝 PHASE 9: Second assistant turn saved")
    disk_conversation.append({
        "role": "assistant",
        "content": "",
        "thought_summary": "Let me verify the structure.",
        "tool_calls": [{
            "id": "call_2",
            "type": "function",
            "function": {"name": "complete_task", "arguments": "{}"}
        }]
    })
    buffer.clear()

    conv, status = simulate_refresh(session_id, disk_conversation)
    log_refresh(9, conv, status)

    # ============================================================
    # PHASE 10: complete_task tool result + complete event
    # ============================================================
    print("\n📝 PHASE 10: Task complete")
    buffer.append(create_sse_event("tool_result", {"tool_call_id": "call_2", "result": "Validated"}))
    disk_conversation.append({
        "role": "tool",
        "tool_call_id": "call_2",
        "content": '{"result": "Validated"}',
        "name": "complete_task"
    })
    buffer.clear()
    buffer.append(create_sse_event("complete", {"success": True, "reason": "GOAL"}))
    buffer.mark_complete()

    conv, status = simulate_refresh(session_id, disk_conversation)
    log_refresh("FINAL", conv, status)

    # ============================================================
    # VERIFICATION
    # ============================================================
    print(f"\n{'='*60}")
    print("VERIFICATION")
    print(f"{'='*60}")

    expected_messages = [
        "user",      # Build me a medieval castle
        "assistant", # First response with edit_code
        "tool",      # edit_code result
        "assistant", # Second response with complete_task
        "tool",      # complete_task result
    ]

    if len(conv) == len(expected_messages):
        all_match = all(conv[i]["role"] == expected_messages[i] for i in range(len(conv)))
        if all_match:
            print("✅ Final conversation has correct structure!")
        else:
            print("❌ Message roles don't match expected order")
    else:
        print(f"❌ Expected {len(expected_messages)} messages, got {len(conv)}")

    print("\n" + "🎉"*30)
    print("SIMULATION COMPLETE")
    print("🎉"*30 + "\n")


if __name__ == "__main__":
    main()

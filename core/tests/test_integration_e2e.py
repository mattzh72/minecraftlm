"""
End-to-end integration test with live Gemini API

Run with: pytest tests/test_integration_e2e.py -v -s

Requires GEMINI_API_KEY environment variable set
"""

import os

import pytest

from app.agent.harness import AgentHarness, TerminateReason
from app.services.session import SessionService


@pytest.mark.integration
@pytest.mark.asyncio
async def test_agent_e2e_simple_structure():
    """
    End-to-end test: Agent builds a simple structure.

    This test runs the full agent loop with real Gemini API calls.
    Uses real storage (not temp) so you can inspect the session afterward.
    """
    # Check for API key
    if not os.getenv("GEMINI_API_KEY"):
        pytest.skip("GEMINI_API_KEY not set - skipping E2E test")

    # Create session (uses real storage)
    session_id = SessionService.create_session()
    print(f"\nCreated session: {session_id}")

    # Verify session files were created
    from app.services.session import STORAGE_DIR
    session_dir = STORAGE_DIR / session_id
    assert session_dir.exists(), f"Session directory not created: {session_dir}"
    assert (session_dir / "code.py").exists(), "code.py not created"
    assert (session_dir / "conversation.json").exists(), "conversation.json not created"
    print(f"Session directory: {session_dir}")

    # Create agent
    agent = AgentHarness(session_id=session_id, max_turns=15, max_time_minutes=3)

    # User prompt
    user_message = "Create a simple 3x3 stone platform at y=0"

    print(f"User message: {user_message}")
    print("Starting agent loop...")

    # Track events
    events = []
    tool_calls = []

    # Run agent
    async for event in agent.run(user_message):
        events.append(event)
        print(f"Event: {event.type} - {event.data}")

        if event.type == "tool_call":
            tool_calls.append(event.data["name"])

        if event.type == "complete":
            break

    # Assertions
    assert len(events) > 0, "No events received"

    completion_event = events[-1]
    assert completion_event.type == "complete"
    assert completion_event.data["success"], f"Agent failed: {completion_event.data['message']}"
    assert completion_event.data["reason"] == TerminateReason.GOAL

    # Verify tools were used
    assert "edit_code" in tool_calls, "Agent should have edited code"
    assert "complete_task" in tool_calls, "Agent should have called complete_task"

    # Verify code was written
    final_code = SessionService.load_code(session_id)
    print(f"\nFinal code:\n{final_code}")

    assert len(final_code) > 50, "Code should be written"
    assert "stone" in final_code.lower(), "Code should mention stone"

    # Verify conversation was saved
    conversation = SessionService.load_conversation(session_id)
    assert len(conversation) >= 2
    assert conversation[0]["role"] == "user"

    print("\nE2E test passed!")

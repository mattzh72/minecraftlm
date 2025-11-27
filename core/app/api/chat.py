"""
Chat API endpoints
"""

import json
from typing import AsyncIterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.agent.harness import AgentHarness
from app.services.session import SessionService

router = APIRouter()


class ChatRequest(BaseModel):
    """Request model for chat"""

    session_id: str
    message: str


class SessionResponse(BaseModel):
    """Response model for session creation"""

    session_id: str


@router.post("/sessions", response_model=SessionResponse)
async def create_session():
    """
    Create a new chat session.
    Returns the session_id which maps to storage/sessions/{session_id}/
    """
    session_id = SessionService.create_session()
    return SessionResponse(session_id=session_id)


async def chat_stream(request: ChatRequest) -> AsyncIterator[str]:
    """
    Stream agent activity as Server-Sent Events.

    Event types:
    - turn_start: Agent turn beginning
    - thought: Agent reasoning/text
    - tool_call: Agent calling a tool
    - tool_result: Tool execution result
    - complete: Task finished (success or error)
    """
    try:
        # Create agent executor
        agent = AgentHarness(session_id=request.session_id)

        # Run agent loop and stream events
        async for event in agent.run(request.message):
            # Format as SSE
            event_json = json.dumps({"type": event.type, "data": event.data})
            yield f"data: {event_json}\n\n"

    except FileNotFoundError:
        error_event = json.dumps(
            {
                "type": "error",
                "data": {"message": f"Session {request.session_id} not found"},
            }
        )
        yield f"data: {error_event}\n\n"
    except Exception as e:
        error_event = json.dumps(
            {"type": "error", "data": {"message": f"Error: {str(e)}"}}
        )
        yield f"data: {error_event}\n\n"


@router.post("/chat")
async def chat(request: ChatRequest):
    """
    Send a message and run the agentic loop.

    The agent will:
    1. Use read_code to see current SDK code
    2. Use edit_code to iteratively improve the code
    3. Call complete_task when done (automatic validation)
    4. Continue fixing if validation fails
    5. Stop when validation passes

    Streams activity events (thoughts, tool calls, results) back as SSE.
    Frontend can read the final code from storage/sessions/{session_id}/code.py
    """
    return StreamingResponse(chat_stream(request), media_type="text/event-stream")

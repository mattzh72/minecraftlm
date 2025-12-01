"""
Chat API endpoints
"""

import json
from pathlib import Path
from typing import AsyncIterator

from app.api.models.chat import SSEPayload, sse_repr
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse

from app.agent.harness import MinecraftSchematicAgent
from app.services.session import SessionService
from app.api.models import ChatRequest, SessionResponse

router = APIRouter()


CODE_FNAME = "code.json"
# Store sessions outside backend/ to avoid triggering uvicorn reload
LOCAL_STORAGE_FOLDER = Path(__file__).parent.parent.parent.parent / ".storage" / "sessions"


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
        agent = MinecraftSchematicAgent(session_id=request.session_id)

        # Run agent loop and stream events
        async for event in agent.run(request.message):
            # Format as SSE
            yield sse_repr.format(
                payload=SSEPayload(type=event.type, data=event.data).model_dump_json()
            )

    except FileNotFoundError:
        yield sse_repr.format(
            payload=SSEPayload(
                type="error",
                data={"message": f"Session {request.session_id} not found"},
            ).model_dump_json()
        )
    except Exception as e:
        yield sse_repr.format(
            payload=SSEPayload(
                type="error", data={"message": f"Error: {str(e)}"}
            ).model_dump_json()
        )


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
    return StreamingResponse(
        chat_stream(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


@router.get("/sessions/{session_id}/structure")
async def get_structure(session_id: str):
    """
    Get the generated Minecraft structure JSON for visualization.
    Returns the code.json file which contains the structure data.
    """
    code_path = Path(LOCAL_STORAGE_FOLDER) / session_id / CODE_FNAME
    if not code_path.exists():
        raise HTTPException(
            status_code=404, detail=f"Structure not found for session {session_id}"
        )

    try:
        with open(code_path, "r") as f:
            structure_data = json.load(f)
        return JSONResponse(content=structure_data)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error reading structure: {str(e)}"
        )

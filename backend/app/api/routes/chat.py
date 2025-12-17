"""
Chat API endpoints
"""

import asyncio
import logging

from app.agent.harness import ActivityEventType, MinecraftSchematicAgent
from app.api.models import ChatRequest
from app.api.models.chat import ChatResponse, PayloadEventType, SSEPayload, sse_repr
from app.services.event_buffer import (
    SessionEventBuffer,
    create_new_buffer,
    is_task_running,
)
from app.services.session import SessionService
from fastapi import APIRouter, HTTPException

router = APIRouter()
logger = logging.getLogger(__name__)

# Internal event types that should not be sent to frontend
INTERNAL_EVENTS = {"full_message"}

# Store strong references to background tasks to prevent garbage collection
# See: https://docs.python.org/3/library/asyncio-task.html#creating-tasks
_background_tasks: set[asyncio.Task] = set()


def _make_sse(event_type: ActivityEventType | PayloadEventType, data: dict) -> str:
    """Create a pre-serialized SSE string."""
    return sse_repr.format(
        payload=SSEPayload(type=event_type, data=data).model_dump_json()
    )


async def run_agent_task(request: ChatRequest, buffer: SessionEventBuffer) -> None:
    """
    Run the agent loop as a background task, writing pre-serialized SSE events to the buffer.

    Handles:
    - Loading conversation from disk before starting agent
    - Setting model on session
    - Processing full_message events (save to disk, clear buffer)
    - Forwarding frontend events to buffer
    """
    try:
        # Load conversation from disk and add user message
        conversation = await SessionService.load_conversation(request.session_id)
        conversation.append({"role": "user", "content": request.message})
        # Persist user message immediately
        await SessionService.save_conversation(request.session_id, conversation)
        # Lock model to session
        await SessionService.set_model(request.session_id, request.model)

        agent = MinecraftSchematicAgent(
            session_id=request.session_id,
            model=request.model,
            thinking_level=request.thinking_level,
        )

        async for event in agent.run(conversation):
            if event.type == "full_message":
                # Handle internal save event
                conv_data = event.data.get("conversation", [])
                await SessionService.save_conversation(request.session_id, conv_data)
                # Clear buffer after save - buffer only holds unsaved events
                buffer.clear()
            elif event.type not in INTERNAL_EVENTS:
                # Forward to frontend via buffer
                buffer.append(_make_sse(event.type, event.data))

        # Mark complete on success
        buffer.mark_complete()

    except FileNotFoundError:
        error_msg = f"Session {request.session_id} not found"
        logger.error("Session not found: %s", request.session_id)
        buffer.append(_make_sse("complete", {"success": False, "error": error_msg}))
        buffer.mark_complete(error=error_msg)

    except Exception as e:
        error_msg = str(e)
        logger.exception("Error while running agent for session %s", request.session_id)
        buffer.append(_make_sse("complete", {"success": False, "error": error_msg}))
        buffer.mark_complete(error=error_msg)


@router.post("/chat")
async def chat(request: ChatRequest):
    """
    Send a message and run the agentic loop.

    The agent will:
    1. Use read_code to see current SDK code
    2. Use edit_code to iteratively improve the code (automatic validation after each edit)
    3. Continue fixing if validation fails
    4. When done, respond with a completion message

    The agent runs as a background task. Use GET /sessions/{session_id}/stream
    to subscribe to the event stream.

    Returns 409 if a task is already running for this session.
    """
    # Check if task already running
    if is_task_running(request.session_id):
        raise HTTPException(
            status_code=409, detail="Task already running for this session"
        )

    # Create fresh buffer for new task
    buffer = create_new_buffer(request.session_id)

    # Create task and store strong reference to prevent GC
    task = asyncio.create_task(run_agent_task(request, buffer))
    _background_tasks.add(task)
    # Remove from set when done to allow cleanup
    task.add_done_callback(_background_tasks.discard)

    return ChatResponse(status="started", session_id=request.session_id)

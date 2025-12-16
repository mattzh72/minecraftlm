"""
Chat API endpoints
"""

import asyncio
import logging

from app.agent.harness import MinecraftSchematicAgent
from app.api.models import ChatRequest
from app.services.event_buffer import (
    create_new_buffer,
    is_task_running,
    SessionEventBuffer,
)
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

router = APIRouter()
logger = logging.getLogger(__name__)

# Store strong references to background tasks to prevent garbage collection
# See: https://docs.python.org/3/library/asyncio-task.html#creating-tasks
_background_tasks: set[asyncio.Task] = set()


async def run_agent_task(
    request: ChatRequest, buffer: SessionEventBuffer
) -> None:
    """
    Run the agent loop as a background task, writing events to the buffer.
    """
    try:
        agent = MinecraftSchematicAgent(
            session_id=request.session_id, model=request.model
        )

        async for event in agent.run(request.message):
            buffer.append({"type": event.type, "data": event.data})

        # Mark complete on success
        buffer.mark_complete()

    except FileNotFoundError:
        buffer.append({
            "type": "error",
            "data": {"message": f"Session {request.session_id} not found"},
        })
        buffer.mark_complete(error=f"Session {request.session_id} not found")

    except Exception as e:
        logger.exception(
            "Error while running agent for session %s", request.session_id
        )
        buffer.append({
            "type": "error",
            "data": {"message": f"Error: {str(e)}"},
        })
        buffer.mark_complete(error=str(e))


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

    The agent runs as a background task. Use GET /sessions/{session_id}/stream
    to subscribe to the event stream.

    Returns 409 if a task is already running for this session.
    """
    # Check if task already running
    if is_task_running(request.session_id):
        raise HTTPException(
            status_code=409,
            detail="Task already running for this session"
        )

    # Create fresh buffer for new task
    buffer = create_new_buffer(request.session_id)

    # Create task and store strong reference to prevent GC
    task = asyncio.create_task(run_agent_task(request, buffer))
    _background_tasks.add(task)
    # Remove from set when done to allow cleanup
    task.add_done_callback(_background_tasks.discard)

    return JSONResponse(
        content={"status": "started", "session_id": request.session_id}
    )

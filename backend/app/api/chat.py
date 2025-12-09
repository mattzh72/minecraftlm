"""
Chat API endpoints
"""

from typing import AsyncIterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.agent.harness import MinecraftSchematicAgent
from app.api.models import ChatRequest
from app.api.models.chat import SSEPayload, sse_repr
from app.dependencies import LLM, Session
from app.services.llm import LLMService
from app.services.session import SessionService

router = APIRouter()


async def chat_stream(
    request: ChatRequest,
    llm_service: LLMService,
    session_service: SessionService,
) -> AsyncIterator[str]:
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
        # Create agent executor with injected services
        agent = MinecraftSchematicAgent(
            session_id=request.session_id,
            llm_service=llm_service,
            session_service=session_service,
        )

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
async def chat(request: ChatRequest, llm: LLM, session: Session):
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
        chat_stream(request, llm, session),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )

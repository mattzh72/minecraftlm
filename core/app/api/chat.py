"""
Chat API endpoints
"""

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

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
    # TODO: Implement session creation
    pass


@router.post("/chat")
async def chat(request: ChatRequest):
    """
    Send a message and stream back the assistant's response.

    Flow:
    1. Load session from storage/sessions/{session_id}/
    2. Add user message to conversation.json
    3. Call Gemini API with conversation history
    4. Stream response back to client (SSE)
    5. Generate SDK code from response
    6. Execute code to produce schematic
    7. Save everything to files (conversation.json, code.py, schematic.json)

    Frontend will read files directly from storage/ to display results.
    """
    # TODO: Implement streaming chat
    pass

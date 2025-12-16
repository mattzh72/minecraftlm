from typing import Any, Literal
from pydantic import BaseModel

from app.agent.harness import ActivityEventType

sse_repr = "data: {payload}\n\n"


class ChatRequest(BaseModel):
    """Request model for chat"""

    session_id: str
    message: str
    model: str | None = None  # Optional - defaults to server config


class ChatResponse(BaseModel):
    """Response model for chat task start"""

    status: Literal["started"]
    session_id: str


class SSEPayload(BaseModel):
    """Payload for SSE"""

    type: ActivityEventType
    data: Any

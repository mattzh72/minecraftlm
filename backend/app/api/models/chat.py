from typing import Any, Literal

from app.agent.harness import ActivityEventType
from pydantic import BaseModel

PayloadEventType = Literal["success", "failure"]
sse_repr = "data: {payload}\n\n"

ThinkingLevel = Literal["low", "med", "high"]


class ChatRequest(BaseModel):
    """Request model for chat"""

    session_id: str
    message: str
    model: str | None = None  # Optional - defaults to server config
    thinking_level: ThinkingLevel = "med"  # Default to medium thinking


class ChatResponse(BaseModel):
    """Response model for chat task start"""

    status: Literal["started"]
    session_id: str


class SSEPayload(BaseModel):
    """Payload for SSE"""

    type: ActivityEventType | PayloadEventType
    data: Any

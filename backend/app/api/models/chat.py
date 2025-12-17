from typing import Any, Literal
from pydantic import BaseModel

from app.agent.harness import ActivityEventType

sse_repr = "data: {payload}\n\n"

ThinkingLevel = Literal["low", "med", "high"]


class ChatRequest(BaseModel):
    """Request model for chat"""

    session_id: str
    message: str
    model: str | None = None  # Optional - defaults to server config
    thinking_level: ThinkingLevel = "med"  # Default to medium thinking


class SSEPayload(BaseModel):
    """Payload for SSE"""

    type: ActivityEventType
    data: Any

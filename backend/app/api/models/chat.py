from typing import Any
from pydantic import BaseModel

from app.agent.harness import ActivityEventType

sse_repr = "data: {payload}\n\n"


class ChatRequest(BaseModel):
    """Request model for chat"""

    session_id: str
    message: str
    model: str | None = None  # Optional - defaults to server config


class SSEPayload(BaseModel):
    """Payload for SSE"""

    type: ActivityEventType
    data: Any

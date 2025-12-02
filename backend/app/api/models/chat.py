from typing import Any, Literal, Union
from app.agent.harness import ActivityEventType
from pydantic import BaseModel


sse_repr = "data: {payload}\n\n"


class ChatRequest(BaseModel):
    """Request model for chat"""

    session_id: str
    message: str


class SSEPayload(BaseModel):
    """Payload for SSE"""

    type: Union[ActivityEventType, Literal["error"]]
    data: Any

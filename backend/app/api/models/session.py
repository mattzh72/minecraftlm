from pydantic import BaseModel


class SessionResponse(BaseModel):
    """Response model for session creation"""

    session_id: str

"""
Individual dependency getters and type aliases for FastAPI DI.
"""

from typing import Annotated

from fastapi import Depends

from app.config import Settings
from app.dependencies.server_state import State
from app.services.llm import LLMService
from app.services.session import SessionService


def get_settings(state: State) -> Settings:
    """Get the application settings."""
    return state.settings


def get_llm_service(state: State) -> LLMService:
    """Get the LLM service instance."""
    return state.llm_service


def get_session_service(state: State) -> SessionService:
    """Get the session service instance."""
    return state.session_service


# Type aliases for clean route signatures
AppSettings = Annotated[Settings, Depends(get_settings)]
LLM = Annotated[LLMService, Depends(get_llm_service)]
Session = Annotated[SessionService, Depends(get_session_service)]

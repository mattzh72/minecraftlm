"""
ServerState singleton - holds all service instances initialized at startup.
Follows the pattern from sake codebase.
"""

import logging
from typing import Annotated, final

from fastapi import Depends

from app.config import Settings

logger = logging.getLogger(__name__)


@final
class ServerState:
    """ServerState holds global dependencies that need to be
    configured at application startup."""

    def __init__(self, settings: Settings):
        # Import here to avoid circular imports
        from app.services.llm import LLMService
        from app.services.session import SessionService

        self.settings = settings

        # Initialize services
        self.llm_service = LLMService(settings)
        self.session_service = SessionService(settings.storage_dir)

        logger.info(f"ServerState initialized with model: {settings.llm_model}")

    async def shutdown(self):
        """Call this on shutdown to clean up stateful resources."""
        logger.info("ServerState shutting down")


# Global state object
server_state: ServerState | None = None


def set_server_state(settings: Settings):
    """Configure global state at application startup."""
    global server_state
    server_state = ServerState(settings)


async def shutdown_server_state():
    """Shutdown and cleanup global state."""
    global server_state
    if server_state is not None:
        await server_state.shutdown()


def get_server_state() -> ServerState:
    """Get the global server state. Raises if not configured."""
    global server_state
    if server_state is None:
        raise RuntimeError("ServerState is not configured. Call set_server_state() first.")
    return server_state


State = Annotated[ServerState, Depends(get_server_state)]
"""State is the global application state. Use this in dependency
functions to access configured services."""

"""
FastAPI application entry point
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import chat, session
from app.config import Settings
from app.dependencies import set_server_state, shutdown_server_state
from app.errors import register_exception_handlers

# Configure logging early
logging.basicConfig(
    level="INFO",
    format="%(levelname)s:     %(name)s - %(message)s",
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize ServerState with settings
    settings = Settings()
    set_server_state(settings)

    logger.info(f"LLM Model: {settings.llm_model} ({settings.get_provider()})")

    yield

    # Shutdown: Clean up ServerState
    await shutdown_server_state()


app = FastAPI(
    title="Minecraft Schematic Generator",
    description="Agentic interface for generating Minecraft schematics",
    version="0.1.0",
    lifespan=lifespan,
)

# Register centralized exception handlers
register_exception_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat, prefix="/api", tags=["chat"])
app.include_router(session, prefix="/api", tags=["sessions"])


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}


# Serve static files from frontend build (if exists)
# Note: We use PROJECT_ROOT here since this runs at import time before ServerState
from app.config import PROJECT_ROOT

_frontend_build = PROJECT_ROOT / "frontend" / "dist"
if _frontend_build.exists():
    # Mount static assets
    app.mount(
        "/assets", StaticFiles(directory=_frontend_build / "assets"), name="assets"
    )

    # Catch-all route for SPA - must be last
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve React SPA for all non-API routes"""
        # If it's an API route, let it pass through (shouldn't reach here)
        if full_path.startswith("api/"):
            return {"error": "Not found"}

        # Check if file exists in build directory
        file_path = _frontend_build / full_path
        if file_path.is_file():
            return FileResponse(file_path)

        # Otherwise return index.html for SPA routing
        return FileResponse(_frontend_build / "index.html")

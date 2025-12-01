"""
FastAPI application entry point
"""

from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.api import chat

app = FastAPI(
    title="Minecraft Schematic Generator",
    description="Agentic interface for generating Minecraft schematics",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api", tags=["chat"])


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}


# Serve static files from frontend build (if exists)
frontend_build = Path(__file__).parent.parent.parent / "frontend" / "dist"
if frontend_build.exists():
    # Mount static assets
    app.mount(
        "/assets", StaticFiles(directory=frontend_build / "assets"), name="assets"
    )

    # Catch-all route for SPA - must be last
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve React SPA for all non-API routes"""
        # If it's an API route, let it pass through (shouldn't reach here)
        if full_path.startswith("api/"):
            return {"error": "Not found"}

        # Check if file exists in build directory
        file_path = frontend_build / full_path
        if file_path.is_file():
            return FileResponse(file_path)

        # Otherwise return index.html for SPA routing
        return FileResponse(frontend_build / "index.html")

"""
FastAPI application entry point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import chat
from app.config import settings

app = FastAPI(
    title="Minecraft Schematic Generator",
    description="Agentic interface for generating Minecraft schematics",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api", tags=["chat"])


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "message": "Minecraft Schematic Generator API"}


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}

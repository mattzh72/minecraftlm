"""
Session API endpoints
"""

import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.api.models import SessionResponse
from app.config import settings
from app.services.session import SessionService

router = APIRouter()

CODE_FNAME = "code.json"


@router.get("/sessions")
async def list_sessions():
    """
    List all available sessions with metadata.
    """
    sessions = []
    if settings.storage_dir.exists():
        for session_dir in settings.storage_dir.iterdir():
            if session_dir.is_dir():
                session_id = session_dir.name
                # Get basic info
                has_structure = (session_dir / CODE_FNAME).exists()
                conversation_path = session_dir / "conversation.json"
                message_count = 0
                if conversation_path.exists():
                    try:
                        with open(conversation_path, "r") as f:
                            conv = json.load(f)
                            message_count = len(conv)
                    except (json.JSONDecodeError, IOError):
                        pass

                # Load metadata for timestamps
                metadata_path = session_dir / "metadata.json"
                created_at = None
                updated_at = None
                if metadata_path.exists():
                    try:
                        with open(metadata_path, "r") as f:
                            metadata = json.load(f)
                            created_at = metadata.get("created_at")
                            updated_at = metadata.get("updated_at")
                    except (json.JSONDecodeError, IOError):
                        pass

                sessions.append(
                    {
                        "session_id": session_id,
                        "has_structure": has_structure,
                        "message_count": message_count,
                        "created_at": created_at,
                        "updated_at": updated_at,
                    }
                )

    # Sort by updated_at (most recent first)
    sessions.sort(key=lambda s: s.get("updated_at") or "", reverse=True)

    return JSONResponse(content={"sessions": sessions})


@router.post("/sessions", response_model=SessionResponse)
async def create_session():
    """
    Create a new chat session.
    Returns the session_id which maps to storage/sessions/{session_id}/
    """
    session_id = SessionService.create_session()
    return SessionResponse(session_id=session_id)


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """
    Get session data including conversation history and structure (if exists).
    Used to restore sessions on page reload.
    """
    session_dir = settings.storage_dir / session_id
    if not session_dir.exists():
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    try:
        # Load conversation
        conversation_path = session_dir / "conversation.json"
        conversation = []
        if conversation_path.exists():
            with open(conversation_path, "r") as f:
                conversation = json.load(f)

        # Load structure if exists
        structure_path = session_dir / CODE_FNAME
        structure = None
        if structure_path.exists():
            with open(structure_path, "r") as f:
                structure = json.load(f)

        return JSONResponse(
            content={
                "session_id": session_id,
                "conversation": conversation,
                "structure": structure,
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading session: {str(e)}")


@router.get("/sessions/{session_id}/structure")
async def get_structure(session_id: str):
    """
    Get the generated Minecraft structure JSON for visualization.
    Returns the code.json file which contains the structure data.
    """
    code_path = settings.storage_dir / session_id / CODE_FNAME
    if not code_path.exists():
        raise HTTPException(
            status_code=404, detail=f"Structure not found for session {session_id}"
        )

    try:
        with open(code_path, "r") as f:
            structure_data = json.load(f)
        return JSONResponse(content=structure_data)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error reading structure: {str(e)}"
        )

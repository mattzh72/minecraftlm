"""
Session API endpoints
"""

import base64
import json
from pathlib import Path

from app.api.models import SessionResponse
from app.api.models.chat import sse_repr
from app.services.event_buffer import get_buffer, get_or_create_buffer
from app.services.session import SessionService
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse

router = APIRouter()

CODE_FNAME = "code.json"
THUMBNAIL_FNAME = "thumbnail.png"
# Store sessions outside backend/ to avoid triggering uvicorn reload
LOCAL_STORAGE_FOLDER = (
    Path(__file__).parent.parent.parent.parent.parent / ".storage" / "sessions"
)


@router.get("/sessions")
async def list_sessions():
    """
    List all available sessions with metadata.
    """
    sessions = []
    if LOCAL_STORAGE_FOLDER.exists():
        for session_dir in LOCAL_STORAGE_FOLDER.iterdir():
            if session_dir.is_dir():
                session_id = session_dir.name
                # Get basic info
                has_structure = (session_dir / CODE_FNAME).exists()
                has_thumbnail = (session_dir / THUMBNAIL_FNAME).exists()
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
                        "has_thumbnail": has_thumbnail,
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
    session_dir = Path(LOCAL_STORAGE_FOLDER) / session_id
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

        # Load model from metadata
        model = SessionService.get_model(session_id)

        return JSONResponse(
            content={
                "session_id": session_id,
                "conversation": conversation,
                "structure": structure,
                "model": model,
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading session: {str(e)}")


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """
    Delete a session and all its associated data.
    """
    try:
        SessionService.delete_session(session_id)
        return JSONResponse(content={"message": f"Session {session_id} deleted"})
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting session: {str(e)}")


@router.get("/sessions/{session_id}/structure")
async def get_structure(session_id: str):
    """
    Get the generated Minecraft structure JSON for visualization.
    Returns the code.json file which contains the structure data.
    """
    code_path = Path(LOCAL_STORAGE_FOLDER) / session_id / CODE_FNAME
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


@router.get("/sessions/{session_id}/thumbnail")
async def get_thumbnail(session_id: str):
    """
    Get the cached thumbnail image for a session.
    Returns the thumbnail.png file if it exists.
    """
    thumbnail_path = Path(LOCAL_STORAGE_FOLDER) / session_id / THUMBNAIL_FNAME
    if not thumbnail_path.exists():
        raise HTTPException(
            status_code=404, detail=f"Thumbnail not found for session {session_id}"
        )

    return FileResponse(
        thumbnail_path,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=31536000"},  # Cache for 1 year
    )


@router.post("/sessions/{session_id}/thumbnail")
async def upload_thumbnail(session_id: str, request: Request):
    """
    Upload and save a thumbnail image for a session.
    Accepts base64-encoded PNG image data.
    """
    session_dir = Path(LOCAL_STORAGE_FOLDER) / session_id
    if not session_dir.exists():
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    try:
        body = await request.json()
        image_data = body.get("image")
        if not image_data:
            raise HTTPException(status_code=400, detail="Missing 'image' field")

        # Handle data URL format: "data:image/png;base64,..."
        if image_data.startswith("data:"):
            # Extract base64 portion after the comma
            image_data = image_data.split(",", 1)[1]

        # Decode base64 and save
        image_bytes = base64.b64decode(image_data)
        thumbnail_path = session_dir / THUMBNAIL_FNAME
        with open(thumbnail_path, "wb") as f:
            f.write(image_bytes)

        return JSONResponse(content={"message": "Thumbnail saved successfully"})
    except base64.binascii.Error:
        raise HTTPException(status_code=400, detail="Invalid base64 image data")
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error saving thumbnail: {str(e)}"
        )


@router.get("/sessions/{session_id}/status")
async def get_session_status(session_id: str):
    """
    Check if session has an active task running.

    Returns:
    - status: "idle" | "running" | "completed" | "error"
    - has_events: whether there are events in the buffer
    - event_count: number of events in the buffer
    - error: error message if status is "error"
    """
    buffer = get_buffer(session_id)

    if buffer is None:
        return JSONResponse(content={
            "status": "idle",
            "has_events": False,
            "event_count": 0,
        })

    status = "running"
    if buffer.is_complete:
        status = "error" if buffer.error else "completed"

    return JSONResponse(content={
        "status": status,
        "has_events": len(buffer.events) > 0,
        "event_count": len(buffer.events),
        "error": buffer.error,
    })


@router.get("/sessions/{session_id}/stream")
async def stream_session_events(session_id: str):
    """
    SSE endpoint to subscribe to session events.

    Streams all past events first, then streams new events in real-time
    until the task completes. Automatically cleans up on disconnect.
    """
    buffer = get_or_create_buffer(session_id)

    async def event_generator():
        async for event in buffer.subscribe():
            # Skip internal events
            if event.get("type", "").startswith("_"):
                continue
            yield sse_repr.format(payload=json.dumps(event))

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

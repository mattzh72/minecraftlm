"""
Session API endpoints
"""

import asyncio
import base64
from pathlib import Path

from app.api.models import SessionResponse
from app.services.event_buffer import (
    get_buffer,
    is_task_running,
    reconstruct_conversation_from_buffer,
)
from app.services.file_ops import get_file_service
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
    session_dirs = await SessionService.list_session_dirs()
    if not session_dirs:
        return JSONResponse(content={"sessions": []})

    # Process all sessions concurrently
    results = await asyncio.gather(
        *[SessionService.get_session_info(d) for d in session_dirs]
    )
    sessions = [s for s in results if s is not None]

    # Sort by updated_at (most recent first)
    sessions.sort(key=lambda s: s.get("updated_at") or "", reverse=True)
    return JSONResponse(content={"sessions": sessions})


@router.post("/sessions", response_model=SessionResponse)
async def create_session():
    """
    Create a new chat session.
    Returns the session_id which maps to storage/sessions/{session_id}/
    """
    session_id = await SessionService.create_session()
    return SessionResponse(session_id=session_id)


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """
    Get session data including conversation history and structure (if exists).
    Used to restore sessions on page reload.

    If a task is currently running, merges disk (completed turns) with
    in-progress assistant message reconstructed from the buffer.
    """
    fs = get_file_service()
    session_dir = Path(LOCAL_STORAGE_FOLDER) / session_id
    if not await fs.exists(session_dir):
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    try:
        conversation = await SessionService.load_conversation(session_id)
    except FileNotFoundError:
        conversation = []

    # If task is running, reconstruct current turn from buffer and append
    if is_task_running(session_id):
        buffer = get_buffer(session_id)
        if buffer:
            current_turn = reconstruct_conversation_from_buffer(buffer)
            if current_turn:
                conversation.append(current_turn)

    try:
        structure_path = session_dir / CODE_FNAME
        if await fs.exists(structure_path):
            structure = await fs.read_json(structure_path)
        else:
            structure = None
    except Exception:
        structure = None

    model = await SessionService.get_model(session_id)

    return JSONResponse(
        content={
            "session_id": session_id,
            "conversation": conversation,
            "structure": structure,
            "model": model,
        }
    )


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """
    Delete a session and all its associated data.
    """
    try:
        await SessionService.delete_session(session_id)
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
    fs = get_file_service()
    code_path = Path(LOCAL_STORAGE_FOLDER) / session_id / CODE_FNAME
    if not await fs.exists(code_path):
        raise HTTPException(
            status_code=404, detail=f"Structure not found for session {session_id}"
        )

    try:
        structure_data = await fs.read_json(code_path)
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
    fs = get_file_service()
    thumbnail_path = Path(LOCAL_STORAGE_FOLDER) / session_id / THUMBNAIL_FNAME
    if not await fs.exists(thumbnail_path):
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
    fs = get_file_service()
    session_dir = Path(LOCAL_STORAGE_FOLDER) / session_id
    if not await fs.exists(session_dir):
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    try:
        body: dict[str, str] = await request.json()
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
        await fs.write_bytes(thumbnail_path, image_bytes)

        return JSONResponse(content={"message": "Thumbnail saved successfully"})
    except base64.binascii.Error:
        raise HTTPException(status_code=400, detail="Invalid base64 image data")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving thumbnail: {str(e)}")


@router.get("/sessions/{session_id}/status")
async def get_session_status(session_id: str):
    """
    Get current task status and all buffered events.

    Returns:
    - status: "idle" | "running" | "completed" | "error"
    - events: list of pre-serialized SSE strings
    - event_count: number of events in the buffer
    - error: error message if status is "error"

    Client should:
    1. Process all events in the response
    2. If status == "running", subscribe to /stream?since=event_count for new events
    """
    buffer = get_buffer(session_id)

    if buffer is None:
        return JSONResponse(content={"status": "idle", "events": [], "event_count": 0})

    status = "running"
    if buffer.is_complete:
        status = "error" if buffer.error else "completed"

    return JSONResponse(
        content={
            "status": status,
            "events": buffer.events,  # Pre-serialized SSE strings
            "event_count": len(buffer.events),
            "error": buffer.error,
        }
    )


@router.get("/sessions/{session_id}/stream")
async def stream_session_events(session_id: str, since: int = 0):
    """
    SSE endpoint to subscribe to session events.

    Args:
        since: Skip first N events (use event_count from /status endpoint)

    Streams events starting from index `since` until task completes.
    Returns 404 if no active buffer exists.
    """
    buffer = get_buffer(session_id)

    # No buffer = no active task, don't create one and poll forever
    if buffer is None:
        raise HTTPException(status_code=404, detail="No active task for this session")

    async def event_generator():
        async for sse_string in buffer.subscribe(since=since):
            yield sse_string

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

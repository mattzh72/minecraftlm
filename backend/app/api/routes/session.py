"""
Session API endpoints
"""

import asyncio
import base64
import json
from pathlib import Path

import aiofiles
import aiofiles.os
from app.api.models import SessionResponse
from app.services.event_buffer import get_buffer
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


async def _path_exists(path: Path) -> bool:
    """Check if path exists without blocking the event loop."""
    return await aiofiles.os.path.exists(path)


async def _path_is_dir(path: Path) -> bool:
    """Check if path is a directory without blocking the event loop."""
    return await aiofiles.os.path.isdir(path)


async def _read_json_file(path: Path) -> dict | list | None:
    """Read and parse a JSON file asynchronously."""
    if not await _path_exists(path):
        return None
    try:
        async with aiofiles.open(path, "r") as f:
            content = await f.read()
            return json.loads(content)
    except (json.JSONDecodeError, IOError):
        return None


async def _get_session_info(session_dir: Path) -> dict | None:
    """Get info for a single session directory (runs file checks concurrently)."""
    if not await _path_is_dir(session_dir):
        return None

    session_id = session_dir.name

    # Run file existence checks and JSON reads concurrently
    has_structure, has_thumbnail, conversation, metadata = await asyncio.gather(
        _path_exists(session_dir / CODE_FNAME),
        _path_exists(session_dir / THUMBNAIL_FNAME),
        _read_json_file(session_dir / "conversation.json"),
        _read_json_file(session_dir / "metadata.json"),
    )

    message_count = len(conversation) if conversation else 0
    created_at = metadata.get("created_at") if metadata else None
    updated_at = metadata.get("updated_at") if metadata else None

    return {
        "session_id": session_id,
        "has_structure": has_structure,
        "has_thumbnail": has_thumbnail,
        "message_count": message_count,
        "created_at": created_at,
        "updated_at": updated_at,
    }


@router.get("/sessions")
async def list_sessions():
    """
    List all available sessions with metadata.
    """
    if not await _path_exists(LOCAL_STORAGE_FOLDER):
        return JSONResponse(content={"sessions": []})

    # Get list of directories (this is the one sync call we can't easily avoid,
    # but it's fast for small numbers of directories)
    session_dirs = list(LOCAL_STORAGE_FOLDER.iterdir())

    # Process all sessions concurrently
    results = await asyncio.gather(*[_get_session_info(d) for d in session_dirs])
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
    session_id = SessionService.create_session()
    return SessionResponse(session_id=session_id)


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """
    Get session data including conversation history and structure (if exists).
    Used to restore sessions on page reload.
    """
    session_dir = Path(LOCAL_STORAGE_FOLDER) / session_id
    if not await _path_exists(session_dir):
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    try:
        conversation = await _read_json_file(session_dir / "conversation.json") or []
        structure = await _read_json_file(session_dir / CODE_FNAME)
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
    if not await _path_exists(code_path):
        raise HTTPException(
            status_code=404, detail=f"Structure not found for session {session_id}"
        )

    try:
        structure_data = await _read_json_file(code_path)
        if structure_data is None:
            raise HTTPException(
                status_code=500, detail="Failed to parse structure JSON"
            )
        return JSONResponse(content=structure_data)
    except HTTPException:
        raise
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
    if not await _path_exists(thumbnail_path):
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
    if not await _path_exists(session_dir):
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

        # Decode base64 and save asynchronously
        image_bytes = base64.b64decode(image_data)
        thumbnail_path = session_dir / THUMBNAIL_FNAME
        async with aiofiles.open(thumbnail_path, "wb") as f:
            await f.write(image_bytes)

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

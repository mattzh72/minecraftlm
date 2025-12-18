"""
Session management service for file-based storage (async)
"""

import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.agent.minecraft.scaffold import DEFAULT_SCAFFOLD
from app.services.file_ops import get_file_service

# Store sessions outside backend/ to avoid triggering uvicorn reload
STORAGE_DIR = Path(__file__).parent.parent.parent.parent / ".storage" / "sessions"


class SessionService:
    """Manages session state in local files (async)"""

    @staticmethod
    async def create_session() -> str:
        """Create a new session directory and return session_id"""
        fs = get_file_service()
        session_id = str(uuid.uuid4())
        session_dir = STORAGE_DIR / session_id
        await fs.mkdir(session_dir, parents=True, exist_ok=True)

        # Initialize files
        await fs.write_json(session_dir / "conversation.json", [])
        # Start with a scaffolded Python script that the agent will edit
        await fs.write_text(session_dir / "code.py", DEFAULT_SCAFFOLD)
        now = SessionService._current_timestamp()
        await SessionService._write_metadata(
            session_id,
            {
                "session_id": session_id,
                "created_at": now,
                "updated_at": now,
            },
        )

        return session_id

    @staticmethod
    async def load_conversation(session_id: str) -> list[dict]:
        """Load conversation history from file"""
        fs = get_file_service()
        conversation_file = STORAGE_DIR / session_id / "conversation.json"
        if not await fs.exists(conversation_file):
            raise FileNotFoundError(f"Session {session_id} not found")
        return await fs.read_json(conversation_file)

    @staticmethod
    async def save_conversation(session_id: str, conversation: list[dict]) -> None:
        """Save conversation history to file"""
        fs = get_file_service()
        conversation_file = STORAGE_DIR / session_id / "conversation.json"
        await fs.write_json(conversation_file, conversation)
        await SessionService._update_metadata(session_id)

    @staticmethod
    async def save_code(session_id: str, code: str) -> None:
        """Save generated SDK code to file"""
        fs = get_file_service()
        code_file = STORAGE_DIR / session_id / "code.py"
        await fs.write_text(code_file, code)
        await SessionService._update_metadata(session_id)

    @staticmethod
    async def load_code(session_id: str) -> str:
        """Load the current SDK code"""
        fs = get_file_service()
        code_file = STORAGE_DIR / session_id / "code.py"
        if not await fs.exists(code_file):
            raise FileNotFoundError(f"Session {session_id} not found")
        return await fs.read_text(code_file)

    @staticmethod
    def _metadata_path(session_id: str) -> Path:
        """Return the path to the metadata file for a session"""
        return STORAGE_DIR / session_id / "metadata.json"

    @staticmethod
    def _current_timestamp() -> str:
        """Return current UTC time in ISO-8601 format"""
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    async def _write_metadata(session_id: str, metadata: dict) -> None:
        """Write metadata to metadata.json with consistent formatting"""
        fs = get_file_service()
        metadata_file = SessionService._metadata_path(session_id)
        await fs.write_json(metadata_file, metadata)

    @staticmethod
    async def _update_metadata(session_id: str, **kwargs) -> None:
        """
        Update the metadata.json updated_at field and any additional fields.

        If the file is missing or malformed, recreate with best-effort values to
        avoid breaking session persistence.
        """
        fs = get_file_service()
        metadata_file = SessionService._metadata_path(session_id)
        now = SessionService._current_timestamp()

        try:
            if await fs.exists(metadata_file):
                metadata = await fs.read_json(metadata_file)
            else:
                metadata = {"session_id": session_id}
        except Exception:
            metadata = {"session_id": session_id}

        metadata.setdefault("created_at", now)
        metadata["updated_at"] = now
        # Update any additional fields passed in
        metadata.update(kwargs)
        await SessionService._write_metadata(session_id, metadata)

    @staticmethod
    async def set_model(session_id: str, model: str) -> None:
        """Set the model for a session (only if not already set)"""
        fs = get_file_service()
        metadata_file = SessionService._metadata_path(session_id)
        try:
            if await fs.exists(metadata_file):
                metadata = await fs.read_json(metadata_file)
                # Only set if not already set (lock to first model used)
                if not metadata.get("model"):
                    await SessionService._update_metadata(session_id, model=model)
        except Exception:
            pass

    @staticmethod
    async def get_model(session_id: str) -> str | None:
        """Get the model for a session"""
        fs = get_file_service()
        metadata_file = SessionService._metadata_path(session_id)
        try:
            if await fs.exists(metadata_file):
                metadata = await fs.read_json(metadata_file)
                return metadata.get("model")
        except Exception:
            pass
        return None

    @staticmethod
    async def save_structure(session_id: str, structure: dict) -> None:
        """Save the generated structure JSON"""
        fs = get_file_service()
        structure_file = STORAGE_DIR / session_id / "code.json"
        await fs.write_json(structure_file, structure)

    @staticmethod
    async def delete_session(session_id: str) -> None:
        """Delete a session and all its associated data"""
        fs = get_file_service()
        session_dir = STORAGE_DIR / session_id
        if not await fs.exists(session_dir):
            raise FileNotFoundError(f"Session {session_id} not found")
        await fs.rmtree(session_dir)

    @staticmethod
    async def list_session_dirs() -> list[Path]:
        """List all session directories"""
        fs = get_file_service()
        if not await fs.exists(STORAGE_DIR):
            return []
        return await fs.iterdir(STORAGE_DIR)

    @staticmethod
    async def get_session_info(session_dir: Path) -> dict | None:
        """Get info for a single session directory."""
        fs = get_file_service()
        if not await fs.is_dir(session_dir):
            return None

        session_id = session_dir.name
        code_file = session_dir / "code.json"
        thumbnail_file = session_dir / "thumbnail.png"
        conversation_file = session_dir / "conversation.json"
        metadata_file = session_dir / "metadata.json"

        # Check existence
        has_structure = await fs.exists(code_file)
        has_thumbnail = await fs.exists(thumbnail_file)

        # Load conversation count
        try:
            if await fs.exists(conversation_file):
                conversation = await fs.read_json(conversation_file)
                message_count = len(conversation) if conversation else 0
            else:
                message_count = 0
        except Exception:
            message_count = 0

        # Load metadata for timestamps
        try:
            if await fs.exists(metadata_file):
                metadata = await fs.read_json(metadata_file)
                created_at = metadata.get("created_at")
                updated_at = metadata.get("updated_at")
            else:
                created_at = None
                updated_at = None
        except Exception:
            created_at = None
            updated_at = None

        return {
            "session_id": session_id,
            "has_structure": has_structure,
            "has_thumbnail": has_thumbnail,
            "message_count": message_count,
            "created_at": created_at,
            "updated_at": updated_at,
        }

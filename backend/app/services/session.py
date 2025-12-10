"""
Session management service for file-based storage
"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.agent.minecraft.scaffold import DEFAULT_SCAFFOLD
from app.config import settings


class SessionService:
    """Manages session state in local files"""

    @staticmethod
    def create_session() -> str:
        """Create a new session directory and return session_id"""
        session_id = str(uuid.uuid4())
        session_dir = settings.storage_dir / session_id
        session_dir.mkdir(parents=True, exist_ok=True)

        # Initialize files
        (session_dir / "conversation.json").write_text(json.dumps([]))
        # Start with a scaffolded Python script that the agent will edit
        (session_dir / "code.py").write_text(DEFAULT_SCAFFOLD)
        now = SessionService._current_timestamp()
        SessionService._write_metadata(
            session_id,
            {
                "session_id": session_id,
                "created_at": now,
                "updated_at": now,
            },
        )

        return session_id

    @staticmethod
    def load_conversation(session_id: str) -> list[dict]:
        """Load conversation history from file"""
        conversation_file = settings.storage_dir / session_id / "conversation.json"
        if not conversation_file.exists():
            raise FileNotFoundError(f"Session {session_id} not found")
        return json.loads(conversation_file.read_text())

    @staticmethod
    def save_conversation(session_id: str, conversation: list[dict]) -> None:
        """Save conversation history to file"""
        conversation_file = settings.storage_dir / session_id / "conversation.json"
        conversation_file.write_text(json.dumps(conversation, indent=2))
        SessionService._update_metadata(session_id)

    @staticmethod
    def save_code(session_id: str, code: str) -> None:
        """Save generated SDK code to file"""
        code_file = settings.storage_dir / session_id / "code.py"
        code_file.write_text(code)
        SessionService._update_metadata(session_id)

    @staticmethod
    def load_code(session_id: str) -> str:
        """Load the current SDK code"""
        code_file = settings.storage_dir / session_id / "code.py"
        if not code_file.exists():
            raise FileNotFoundError(f"Session {session_id} not found")
        return code_file.read_text()

    @staticmethod
    def _metadata_path(session_id: str) -> Path:
        """Return the path to the metadata file for a session"""
        return settings.storage_dir / session_id / "metadata.json"

    @staticmethod
    def _current_timestamp() -> str:
        """Return current UTC time in ISO-8601 format"""
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _write_metadata(session_id: str, metadata: dict) -> None:
        """Write metadata to metadata.json with consistent formatting"""
        metadata_file = SessionService._metadata_path(session_id)
        metadata_file.write_text(json.dumps(metadata, indent=2))

    @staticmethod
    def _update_metadata(session_id: str, **kwargs) -> None:
        """
        Update the metadata.json updated_at field and any additional fields.

        If the file is missing or malformed, recreate with best-effort values to
        avoid breaking session persistence.
        """
        metadata_file = SessionService._metadata_path(session_id)
        now = SessionService._current_timestamp()

        try:
            if metadata_file.exists():
                metadata = json.loads(metadata_file.read_text())
            else:
                metadata = {"session_id": session_id}
        except Exception:
            metadata = {"session_id": session_id}

        metadata.setdefault("created_at", now)
        metadata["updated_at"] = now
        # Update any additional fields passed in
        metadata.update(kwargs)
        SessionService._write_metadata(session_id, metadata)

    @staticmethod
    def set_model(session_id: str, model: str) -> None:
        """Set the model for a session (only if not already set)"""
        metadata_file = SessionService._metadata_path(session_id)
        try:
            if metadata_file.exists():
                metadata = json.loads(metadata_file.read_text())
                # Only set if not already set (lock to first model used)
                if not metadata.get("model"):
                    SessionService._update_metadata(session_id, model=model)
        except Exception:
            pass

    @staticmethod
    def get_model(session_id: str) -> str | None:
        """Get the model for a session"""
        metadata_file = SessionService._metadata_path(session_id)
        try:
            if metadata_file.exists():
                metadata = json.loads(metadata_file.read_text())
                return metadata.get("model")
        except Exception:
            pass
        return None

    @staticmethod
    def save_structure(session_id: str, structure: dict) -> None:
        """Save the generated structure JSON"""
        structure_file = settings.storage_dir / session_id / "code.json"
        structure_file.write_text(json.dumps(structure, indent=2))

    @staticmethod
    def delete_session(session_id: str) -> None:
        """Delete a session and all its associated data"""
        import shutil

        session_dir = settings.storage_dir / session_id
        if not session_dir.exists():
            raise FileNotFoundError(f"Session {session_id} not found")
        shutil.rmtree(session_dir)

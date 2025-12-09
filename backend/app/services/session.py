"""
Session management service for file-based storage
"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.agent.minecraft.scaffold import DEFAULT_SCAFFOLD


class SessionService:
    """Manages session state in local files"""

    def __init__(self, storage_dir: Path):
        """Initialize with storage directory path."""
        self.storage_dir = storage_dir
        # Ensure storage dir exists
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def create_session(self) -> str:
        """Create a new session directory and return session_id"""
        session_id = str(uuid.uuid4())
        session_dir = self.storage_dir / session_id
        session_dir.mkdir(parents=True, exist_ok=True)

        # Initialize files
        (session_dir / "conversation.json").write_text(json.dumps([]))
        # Start with a scaffolded Python script that the agent will edit
        (session_dir / "code.py").write_text(DEFAULT_SCAFFOLD)
        now = self._current_timestamp()
        self._write_metadata(
            session_id,
            {
                "session_id": session_id,
                "created_at": now,
                "updated_at": now,
            },
        )

        return session_id

    def load_conversation(self, session_id: str) -> list[dict]:
        """Load conversation history from file"""
        conversation_file = self.storage_dir / session_id / "conversation.json"
        if not conversation_file.exists():
            raise FileNotFoundError(f"Session {session_id} not found")
        return json.loads(conversation_file.read_text())

    def save_conversation(self, session_id: str, conversation: list[dict]) -> None:
        """Save conversation history to file"""
        conversation_file = self.storage_dir / session_id / "conversation.json"
        conversation_file.write_text(json.dumps(conversation, indent=2))
        self._update_metadata(session_id)

    def save_code(self, session_id: str, code: str) -> None:
        """Save generated SDK code to file"""
        code_file = self.storage_dir / session_id / "code.py"
        code_file.write_text(code)
        self._update_metadata(session_id)

    def load_code(self, session_id: str) -> str:
        """Load the current SDK code"""
        code_file = self.storage_dir / session_id / "code.py"
        if not code_file.exists():
            raise FileNotFoundError(f"Session {session_id} not found")
        return code_file.read_text()

    def _metadata_path(self, session_id: str) -> Path:
        """Return the path to the metadata file for a session"""
        return self.storage_dir / session_id / "metadata.json"

    def _current_timestamp(self) -> str:
        """Return current UTC time in ISO-8601 format"""
        return datetime.now(timezone.utc).isoformat()

    def _write_metadata(self, session_id: str, metadata: dict) -> None:
        """Write metadata to metadata.json with consistent formatting"""
        metadata_file = self._metadata_path(session_id)
        metadata_file.write_text(json.dumps(metadata, indent=2))

    def _update_metadata(self, session_id: str) -> None:
        """
        Update the metadata.json updated_at field.

        If the file is missing or malformed, recreate with best-effort values to
        avoid breaking session persistence.
        """
        metadata_file = self._metadata_path(session_id)
        now = self._current_timestamp()

        try:
            if metadata_file.exists():
                metadata = json.loads(metadata_file.read_text())
            else:
                metadata = {"session_id": session_id}
        except Exception:
            metadata = {"session_id": session_id}

        metadata.setdefault("created_at", now)
        metadata["updated_at"] = now
        self._write_metadata(session_id, metadata)

    def save_structure(self, session_id: str, structure: dict) -> None:
        """Save the generated structure JSON"""
        structure_file = self.storage_dir / session_id / "code.json"
        structure_file.write_text(json.dumps(structure, indent=2))

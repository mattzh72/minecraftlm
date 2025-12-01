"""
Session management service for file-based storage
"""

import json
import uuid
from pathlib import Path

from app.agent.minecraft_sdk.scaffold import DEFAULT_SCAFFOLD

# Store sessions outside backend/ to avoid triggering uvicorn reload
STORAGE_DIR = Path(__file__).parent.parent.parent.parent / ".storage" / "sessions"


class SessionService:
    """Manages session state in local files"""

    @staticmethod
    def create_session() -> str:
        """Create a new session directory and return session_id"""
        session_id = str(uuid.uuid4())
        session_dir = STORAGE_DIR / session_id
        session_dir.mkdir(parents=True, exist_ok=True)

        # Initialize files
        (session_dir / "conversation.json").write_text(json.dumps([]))
        # Start with a scaffolded Python script that the agent will edit
        (session_dir / "code.py").write_text(DEFAULT_SCAFFOLD)
        (session_dir / "metadata.json").write_text(
            json.dumps(
                {
                    "session_id": session_id,
                    "created_at": None,  # TODO: Add timestamp
                    "updated_at": None,
                }
            )
        )

        return session_id

    @staticmethod
    def load_conversation(session_id: str) -> list[dict]:
        """Load conversation history from file"""
        conversation_file = STORAGE_DIR / session_id / "conversation.json"
        if not conversation_file.exists():
            raise FileNotFoundError(f"Session {session_id} not found")
        return json.loads(conversation_file.read_text())

    @staticmethod
    def save_conversation(session_id: str, conversation: list[dict]) -> None:
        """Save conversation history to file"""
        conversation_file = STORAGE_DIR / session_id / "conversation.json"
        conversation_file.write_text(json.dumps(conversation, indent=2))

    @staticmethod
    def save_code(session_id: str, code: str) -> None:
        """Save generated SDK code to file"""
        code_file = STORAGE_DIR / session_id / "code.py"
        code_file.write_text(code)

    @staticmethod
    def load_code(session_id: str) -> str:
        """Load the current SDK code"""
        code_file = STORAGE_DIR / session_id / "code.py"
        if not code_file.exists():
            raise FileNotFoundError(f"Session {session_id} not found")
        return code_file.read_text()

    @staticmethod
    def save_structure(session_id: str, structure: dict) -> None:
        """Save the generated structure JSON"""
        structure_file = STORAGE_DIR / session_id / "code.json"
        structure_file.write_text(json.dumps(structure, indent=2))

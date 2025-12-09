"""
Pytest configuration and fixtures
"""

import tempfile
from pathlib import Path

import pytest

from app.config import Settings
from app.dependencies import set_server_state, get_server_state
from app.services.session import SessionService

# Configure pytest-asyncio
pytest_plugins = ('pytest_asyncio',)


@pytest.fixture
def temp_storage(monkeypatch):
    """Create a temporary storage directory and initialize ServerState for tests."""
    with tempfile.TemporaryDirectory() as tmpdir:
        temp_path = Path(tmpdir) / "sessions"
        temp_path.mkdir(parents=True, exist_ok=True)

        # Create Settings with temp storage_dir
        test_settings = Settings(storage_dir=temp_path)

        # Initialize ServerState with test settings
        set_server_state(test_settings)

        yield temp_path


@pytest.fixture
def session_service(temp_storage) -> SessionService:
    """Get the session service from ServerState."""
    return get_server_state().session_service


@pytest.fixture
def session_with_code(session_service):
    """Create a session with some initial code"""
    session_id = session_service.create_session()

    initial_code = '''# Simple test structure
def build_house():
    """Build a simple house"""
    # Place floor
    for x in range(5):
        for z in range(5):
            place_block("minecraft:oak_planks", x, 0, z)

    # Place walls
    for y in range(1, 4):
        # Front and back walls
        for x in range(5):
            place_block("minecraft:cobblestone", x, y, 0)
            place_block("minecraft:cobblestone", x, y, 4)

        # Side walls
        for z in range(1, 4):
            place_block("minecraft:cobblestone", 0, y, z)
            place_block("minecraft:cobblestone", 4, y, z)

build_house()
'''

    session_service.save_code(session_id, initial_code)

    return session_id

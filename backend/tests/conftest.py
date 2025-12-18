"""
Pytest configuration and fixtures
"""

import tempfile
from pathlib import Path

import pytest

from app.services.session import SessionService

# Configure pytest-asyncio
pytest_plugins = ('pytest_asyncio',)


@pytest.fixture
def temp_storage(monkeypatch):
    """Create a temporary storage directory for tests"""
    with tempfile.TemporaryDirectory() as tmpdir:
        temp_path = Path(tmpdir) / "sessions"
        temp_path.mkdir(parents=True, exist_ok=True)

        # Update the module-level STORAGE_DIR
        import app.services.session as session_module
        original_storage_dir = session_module.STORAGE_DIR
        session_module.STORAGE_DIR = temp_path

        yield temp_path

        # Restore original
        session_module.STORAGE_DIR = original_storage_dir


@pytest.fixture
async def session_with_code(temp_storage):
    """Create a session with some initial code"""
    session_id = await SessionService.create_session()

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

    await SessionService.save_code(session_id, initial_code)

    return session_id

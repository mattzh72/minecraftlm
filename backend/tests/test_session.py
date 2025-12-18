"""
Tests for session service
"""

import json
from pathlib import Path

import pytest

from app.services.session import SessionService


@pytest.mark.asyncio
async def test_create_session(temp_storage):
    """Test that creating a session works"""
    session_id = await SessionService.create_session()

    assert session_id is not None
    assert len(session_id) > 0

    # Check that session directory was created
    session_dir = temp_storage / session_id
    assert session_dir.exists()

    # Check that required files exist
    assert (session_dir / "conversation.json").exists()
    assert (session_dir / "code.py").exists()
    assert (session_dir / "metadata.json").exists()


@pytest.mark.asyncio
async def test_metadata_timestamps_update_on_save(temp_storage):
    """created_at/updated_at should be present and updated when state changes"""
    session_id = await SessionService.create_session()
    session_dir = temp_storage / session_id
    metadata_path = session_dir / "metadata.json"

    metadata = json.loads(metadata_path.read_text())
    assert metadata["created_at"] is not None
    assert metadata["updated_at"] is not None

    original_updated = metadata["updated_at"]

    # Saving conversation should advance updated_at
    await SessionService.save_conversation(
        session_id, [{"role": "user", "content": "hello"}]
    )
    updated_meta = json.loads(metadata_path.read_text())
    assert updated_meta["updated_at"] != original_updated


@pytest.mark.asyncio
async def test_load_conversation(temp_storage):
    """Test loading conversation from session"""
    session_id = await SessionService.create_session()

    # Initially empty
    conversation = await SessionService.load_conversation(session_id)
    assert conversation == []


@pytest.mark.asyncio
async def test_save_and_load_conversation(temp_storage):
    """Test saving and loading conversation"""
    session_id = await SessionService.create_session()

    test_conversation = [
        {"role": "user", "content": "Build me a house"},
        {"role": "model", "content": "I'll build a house for you"},
    ]

    await SessionService.save_conversation(session_id, test_conversation)

    loaded = await SessionService.load_conversation(session_id)
    assert loaded == test_conversation


@pytest.mark.asyncio
async def test_save_and_load_code(temp_storage):
    """Test saving and loading code"""
    session_id = await SessionService.create_session()

    test_code = """
def build_tower():
    for y in range(10):
        place_block("minecraft:stone", 0, y, 0)
"""

    await SessionService.save_code(session_id, test_code)

    loaded = await SessionService.load_code(session_id)
    assert loaded == test_code


@pytest.mark.asyncio
async def test_load_nonexistent_session(temp_storage):
    """Test that loading nonexistent session raises error"""
    with pytest.raises(FileNotFoundError):
        await SessionService.load_conversation("nonexistent-session-id")


@pytest.mark.asyncio
async def test_session_files_are_valid_json(temp_storage):
    """Test that JSON files are properly formatted"""
    session_id = await SessionService.create_session()

    conversation = [{"role": "user", "content": "test"}]
    await SessionService.save_conversation(session_id, conversation)

    # Read and parse JSON directly
    session_dir = temp_storage / session_id
    with open(session_dir / "conversation.json") as f:
        data = json.load(f)
        assert isinstance(data, list)
        assert data == conversation


@pytest.mark.asyncio
async def test_multiple_sessions_isolated(temp_storage):
    """Test that multiple sessions are isolated"""
    session1 = await SessionService.create_session()
    session2 = await SessionService.create_session()

    assert session1 != session2

    # Write different code to each
    await SessionService.save_code(session1, "# Session 1 code")
    await SessionService.save_code(session2, "# Session 2 code")

    # Verify isolation
    code1 = await SessionService.load_code(session1)
    code2 = await SessionService.load_code(session2)

    assert code1 == "# Session 1 code"
    assert code2 == "# Session 2 code"

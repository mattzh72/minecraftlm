"""
Tests for session service
"""

import json

import pytest


def test_create_session(temp_storage, session_service):
    """Test that creating a session works"""
    session_id = session_service.create_session()

    assert session_id is not None
    assert len(session_id) > 0

    # Check that session directory was created
    session_dir = temp_storage / session_id
    assert session_dir.exists()

    # Check that required files exist
    assert (session_dir / "conversation.json").exists()
    assert (session_dir / "code.py").exists()
    assert (session_dir / "metadata.json").exists()


def test_metadata_timestamps_update_on_save(temp_storage, session_service):
    """created_at/updated_at should be present and updated when state changes"""
    session_id = session_service.create_session()
    session_dir = temp_storage / session_id
    metadata_path = session_dir / "metadata.json"

    metadata = json.loads(metadata_path.read_text())
    assert metadata["created_at"] is not None
    assert metadata["updated_at"] is not None

    original_updated = metadata["updated_at"]

    # Saving conversation should advance updated_at
    session_service.save_conversation(
        session_id, [{"role": "user", "content": "hello"}]
    )
    updated_meta = json.loads(metadata_path.read_text())
    assert updated_meta["updated_at"] != original_updated


def test_load_conversation(session_service):
    """Test loading conversation from session"""
    session_id = session_service.create_session()

    # Initially empty
    conversation = session_service.load_conversation(session_id)
    assert conversation == []


def test_save_and_load_conversation(session_service):
    """Test saving and loading conversation"""
    session_id = session_service.create_session()

    test_conversation = [
        {"role": "user", "content": "Build me a house"},
        {"role": "model", "content": "I'll build a house for you"},
    ]

    session_service.save_conversation(session_id, test_conversation)

    loaded = session_service.load_conversation(session_id)
    assert loaded == test_conversation


def test_save_and_load_code(session_service):
    """Test saving and loading code"""
    session_id = session_service.create_session()

    test_code = """
def build_tower():
    for y in range(10):
        place_block("minecraft:stone", 0, y, 0)
"""

    session_service.save_code(session_id, test_code)

    loaded = session_service.load_code(session_id)
    assert loaded == test_code


def test_load_nonexistent_session(session_service):
    """Test that loading nonexistent session raises error"""
    with pytest.raises(FileNotFoundError):
        session_service.load_conversation("nonexistent-session-id")


def test_session_files_are_valid_json(temp_storage, session_service):
    """Test that JSON files are properly formatted"""
    session_id = session_service.create_session()

    conversation = [{"role": "user", "content": "test"}]
    session_service.save_conversation(session_id, conversation)

    # Read and parse JSON directly
    session_dir = temp_storage / session_id
    with open(session_dir / "conversation.json") as f:
        data = json.load(f)
        assert isinstance(data, list)
        assert data == conversation


def test_multiple_sessions_isolated(session_service):
    """Test that multiple sessions are isolated"""
    session1 = session_service.create_session()
    session2 = session_service.create_session()

    assert session1 != session2

    # Write different code to each
    session_service.save_code(session1, "# Session 1 code")
    session_service.save_code(session2, "# Session 2 code")

    # Verify isolation
    code1 = session_service.load_code(session1)
    code2 = session_service.load_code(session2)

    assert code1 == "# Session 1 code"
    assert code2 == "# Session 2 code"

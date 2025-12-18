"""
Tests for agent tools
"""

import pytest
from app.agent.tools.edit_code import EditCodeTool
from app.services.session import SessionService


@pytest.mark.asyncio
async def test_edit_code_tool(session_with_code):
    """Test editing code with old_string/new_string"""
    tool = EditCodeTool()

    # Edit the block type in the code
    invocation = await tool.build(
        {
            "session_id": session_with_code,
            "old_string": '"minecraft:oak_planks"',
            "new_string": '"minecraft:stone"',
        }
    )
    result = await invocation.execute()

    assert result.is_success()
    assert "edited successfully" in result.output.lower()

    # Verify the change
    updated_code = await SessionService.load_code(session_with_code)
    assert '"minecraft:stone"' in updated_code
    assert '"minecraft:oak_planks"' not in updated_code


@pytest.mark.asyncio
async def test_edit_code_old_string_not_found(session_with_code):
    """Test editing with non-existent old_string"""
    tool = EditCodeTool()

    invocation = await tool.build(
        {
            "session_id": session_with_code,
            "old_string": "this string does not exist in the code",
            "new_string": "replacement",
        }
    )
    result = await invocation.execute()

    assert not result.is_success()
    assert "Could not find" in result.error


@pytest.mark.asyncio
async def test_edit_code_non_unique_string(session_with_code):
    """Test editing with non-unique old_string"""
    tool = EditCodeTool()

    # "place_block" appears multiple times
    invocation = await tool.build(
        {
            "session_id": session_with_code,
            "old_string": "place_block",
            "new_string": "set_block",
        }
    )
    result = await invocation.execute()

    assert not result.is_success()
    assert "appears" in result.error and "times" in result.error

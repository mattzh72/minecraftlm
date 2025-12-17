"""
Tests for agent tools
"""

import pytest

from app.agent.tools.complete_task import CompleteTaskTool
from app.agent.tools.edit_code import EditCodeTool
from app.services.session import SessionService


@pytest.mark.asyncio
async def test_edit_code_tool(session_with_code):
    """Test editing code with old_string/new_string"""
    tool = EditCodeTool()

    # Edit the block type in the code
    invocation = await tool.build({
        "session_id": session_with_code,
        "old_string": '"minecraft:oak_planks"',
        "new_string": '"minecraft:stone"'
    })
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

    invocation = await tool.build({
        "session_id": session_with_code,
        "old_string": "this string does not exist in the code",
        "new_string": "replacement"
    })
    result = await invocation.execute()

    assert not result.is_success()
    assert "Could not find" in result.error


@pytest.mark.asyncio
async def test_edit_code_non_unique_string(session_with_code):
    """Test editing with non-unique old_string"""
    tool = EditCodeTool()

    # "place_block" appears multiple times
    invocation = await tool.build({
        "session_id": session_with_code,
        "old_string": "place_block",
        "new_string": "set_block"
    })
    result = await invocation.execute()

    assert not result.is_success()
    assert "appears" in result.error and "times" in result.error


@pytest.mark.asyncio
async def test_complete_task_valid_code(temp_storage):
    """Test completing task with valid code"""
    session_id = await SessionService.create_session()

    valid_code = """
x = 10
y = 20
result = x + y
print(result)
structure = {"width": 1, "height": 1, "depth": 1, "blocks": []}
"""
    await SessionService.save_code(session_id, valid_code)

    tool = CompleteTaskTool()
    invocation = await tool.build({"session_id": session_id})
    result = await invocation.execute()

    assert result.is_success()
    assert "completed successfully" in result.output.lower()


@pytest.mark.asyncio
async def test_complete_task_invalid_syntax(temp_storage):
    """Test completing task with syntax errors"""
    session_id = await SessionService.create_session()

    invalid_code = """
def broken(
    print("syntax error")
"""
    await SessionService.save_code(session_id, invalid_code)

    tool = CompleteTaskTool()
    invocation = await tool.build({"session_id": session_id})
    result = await invocation.execute()

    assert not result.is_success()
    assert "validation failed" in result.error.lower()
    assert "Syntax error" in result.error


@pytest.mark.asyncio
async def test_complete_task_execution_error(temp_storage):
    """Test completing task with execution errors"""
    session_id = await SessionService.create_session()

    error_code = """
x = 10 / 0  # Division by zero
"""
    await SessionService.save_code(session_id, error_code)

    tool = CompleteTaskTool()
    invocation = await tool.build({"session_id": session_id})
    result = await invocation.execute()

    assert not result.is_success()
    assert "validation failed" in result.error.lower()

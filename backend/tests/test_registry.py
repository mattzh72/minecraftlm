"""
Tests for tool registry
"""

import pytest

from app.agent.tools.complete_task import CompleteTaskTool
from app.agent.tools.edit_code import EditCodeTool
from app.agent.tools.registry import ToolRegistry


@pytest.fixture
def registry():
    """Create a tool registry with standard tools"""
    tools = [
        EditCodeTool(),
        CompleteTaskTool(),
    ]
    return ToolRegistry(tools)


def test_registry_initialization(registry):
    """Test that registry initializes with tools"""
    assert len(registry.tools) == 2
    assert "edit_code" in registry.tools
    assert "complete_task" in registry.tools


def test_get_tool(registry):
    """Test getting a tool by name"""
    tool = registry.get_tool("edit_code")
    assert tool is not None
    assert isinstance(tool, EditCodeTool)


def test_get_nonexistent_tool(registry):
    """Test getting a tool that doesn't exist"""
    tool = registry.get_tool("nonexistent_tool")
    assert tool is None


def test_get_all_tool_names(registry):
    """Test getting all tool names"""
    names = registry.get_all_tool_names()
    assert len(names) == 2
    assert "edit_code" in names
    assert "complete_task" in names


def test_get_tool_schemas(registry):
    """Test getting tool schemas in OpenAI format"""
    schemas = registry.get_tool_schemas()
    assert len(schemas) == 2

    # Check that each schema has required fields (OpenAI format)
    for schema in schemas:
        assert schema["type"] == "function"
        assert "function" in schema
        assert "name" in schema["function"]
        assert "description" in schema["function"]
        assert "parameters" in schema["function"]


@pytest.mark.asyncio
async def test_build_invocation(registry, temp_storage):
    """Test building a tool invocation"""
    from app.services.session import SessionService

    session_id = await SessionService.create_session()

    invocation = await registry.build_invocation(
        "edit_code", {"session_id": session_id, "old_string": "x", "new_string": "y"}
    )

    assert invocation is not None
    assert hasattr(invocation, "execute")


@pytest.mark.asyncio
async def test_build_invocation_nonexistent_tool(registry):
    """Test building invocation for nonexistent tool"""
    invocation = await registry.build_invocation(
        "nonexistent_tool", {"param": "value"}
    )

    assert invocation is None


@pytest.mark.asyncio
async def test_build_invocation_invalid_params(registry):
    """Test building invocation with invalid parameters"""
    # Missing required parameter
    with pytest.raises(Exception):  # Pydantic validation error
        await registry.build_invocation("edit_code", {})

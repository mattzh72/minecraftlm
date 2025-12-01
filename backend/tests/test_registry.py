"""
Tests for tool registry
"""

import pytest

from app.agent.tools.complete_task import CompleteTaskTool
from app.agent.tools.edit_code import EditCodeTool
from app.agent.tools.read_code import ReadCodeTool
from app.agent.tools.registry import ToolRegistry


@pytest.fixture
def registry():
    """Create a tool registry with standard tools"""
    tools = [
        ReadCodeTool(),
        EditCodeTool(),
        CompleteTaskTool(),
    ]
    return ToolRegistry(tools)


def test_registry_initialization(registry):
    """Test that registry initializes with tools"""
    assert len(registry.tools) == 3
    assert "read_code" in registry.tools
    assert "edit_code" in registry.tools
    assert "complete_task" in registry.tools


def test_get_tool(registry):
    """Test getting a tool by name"""
    tool = registry.get_tool("read_code")
    assert tool is not None
    assert isinstance(tool, ReadCodeTool)


def test_get_nonexistent_tool(registry):
    """Test getting a tool that doesn't exist"""
    tool = registry.get_tool("nonexistent_tool")
    assert tool is None


def test_get_all_tool_names(registry):
    """Test getting all tool names"""
    names = registry.get_all_tool_names()
    assert len(names) == 3
    assert "read_code" in names
    assert "edit_code" in names
    assert "complete_task" in names


def test_get_function_declarations(registry):
    """Test getting Gemini function declarations"""
    declarations = registry.get_function_declarations()
    assert len(declarations) == 3

    # Check that each declaration has required fields
    for decl in declarations:
        assert hasattr(decl, "name")
        assert hasattr(decl, "description")
        assert hasattr(decl, "parameters")


@pytest.mark.asyncio
async def test_build_invocation(registry, temp_storage):
    """Test building a tool invocation"""
    from app.services.session import SessionService

    session_id = SessionService.create_session()

    invocation = await registry.build_invocation(
        "read_code", {"session_id": session_id}
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
        await registry.build_invocation("read_code", {})

"""
Tests for agent harness
"""

import json

import pytest

from app.agent.harness import MinecraftSchematicAgent
from app.agent.tools.base import ToolResult


class MockFunction:
    """Mock function object for ToolCall"""

    def __init__(self, name: str, arguments: str):
        self.name = name
        self.arguments = arguments


class MockToolCall:
    """Mock ToolCall for testing _execute_tool"""

    def __init__(self, name: str, arguments: dict | str, call_id: str = "test_call_123"):
        self.id = call_id
        self.function = MockFunction(
            name=name,
            arguments=arguments if isinstance(arguments, str) else json.dumps(arguments),
        )


@pytest.mark.asyncio
async def test_execute_tool_missing_required_params(temp_storage, session_with_code):
    """Test that missing required parameters return error instead of raising"""
    agent = MinecraftSchematicAgent(
        session_id=session_with_code,
        model="gemini/gemini-2.0-flash",
    )

    # Call edit_code with missing old_string (only new_string provided)
    tool_call = MockToolCall(
        name="edit_code",
        arguments={"new_string": "some replacement text"},
    )

    result, response = await agent._execute_tool(tool_call)

    # Should return error, not raise
    assert isinstance(result, ToolResult)
    assert not result.is_success()
    assert "Invalid parameters" in result.error
    assert "old_string" in result.error
    assert result.tool_call_id == "test_call_123"

    # Response should be valid tool message
    assert response["role"] == "tool"
    assert response["tool_call_id"] == "test_call_123"


@pytest.mark.asyncio
async def test_execute_tool_invalid_json_arguments(temp_storage, session_with_code):
    """Test that invalid JSON in arguments returns error instead of raising"""
    agent = MinecraftSchematicAgent(
        session_id=session_with_code,
        model="gemini/gemini-2.0-flash",
    )

    # Call with malformed JSON
    tool_call = MockToolCall(
        name="edit_code",
        arguments="{not valid json",
    )

    result, response = await agent._execute_tool(tool_call)

    assert isinstance(result, ToolResult)
    assert not result.is_success()
    assert "Invalid JSON" in result.error


@pytest.mark.asyncio
async def test_execute_tool_unknown_tool(temp_storage, session_with_code):
    """Test that unknown tool names return error"""
    agent = MinecraftSchematicAgent(
        session_id=session_with_code,
        model="gemini/gemini-2.0-flash",
    )

    tool_call = MockToolCall(
        name="nonexistent_tool",
        arguments={"foo": "bar"},
    )

    result, response = await agent._execute_tool(tool_call)

    assert isinstance(result, ToolResult)
    assert not result.is_success()
    assert "not found" in result.error


@pytest.mark.asyncio
async def test_execute_tool_valid_call(temp_storage, session_with_code):
    """Test that valid tool calls still work correctly"""
    agent = MinecraftSchematicAgent(
        session_id=session_with_code,
        model="gemini/gemini-2.0-flash",
    )

    tool_call = MockToolCall(
        name="read_code",
        arguments={},
    )

    result, response = await agent._execute_tool(tool_call)

    assert isinstance(result, ToolResult)
    assert result.is_success()
    assert "build_house" in result.output  # From the fixture code

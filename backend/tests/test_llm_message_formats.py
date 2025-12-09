"""
Tests for LLM message format conversions.

All providers should be able to convert to/from the canonical OpenAI-style format
used for storage. This ensures conversations can be continued across providers
(with the caveat that tool call IDs are provider-specific).
"""

import json
import pytest

from app.agent.llms.anthropic import AnthropicService
from app.agent.llms.gemini import GeminiService
from app.agent.llms.oai import OpenAIService


# =============================================================================
# Test fixtures - canonical message formats (OpenAI-style, used for storage)
# =============================================================================

@pytest.fixture
def simple_user_message():
    """Simple user message"""
    return {"role": "user", "content": "Build me a house"}


@pytest.fixture
def simple_assistant_message():
    """Simple assistant text response"""
    return {
        "role": "assistant",
        "content": "I'll build you a nice wooden house.",
        "thought_summary": None,
        "tool_calls": None,
    }


@pytest.fixture
def assistant_with_thinking():
    """Assistant message with thinking/reasoning"""
    return {
        "role": "assistant",
        "content": "I'll create a cozy cottage for you.",
        "thought_summary": "The user wants a house. I should use oak wood for a warm feel.",
        "tool_calls": None,
    }


@pytest.fixture
def assistant_with_tool_call():
    """Assistant message with a tool call"""
    return {
        "role": "assistant",
        "content": "",
        "thought_summary": "I need to read the current code first.",
        "tool_calls": [
            {
                "id": "call_abc123",
                "type": "function",
                "function": {
                    "name": "read_code",
                    "arguments": json.dumps({}),
                },
                "thought_signature": None,
                "extra_content": {},
            }
        ],
    }


@pytest.fixture
def assistant_with_multiple_tool_calls():
    """Assistant message with multiple tool calls"""
    return {
        "role": "assistant",
        "content": "Let me update the code.",
        "thought_summary": "I'll edit the code to add walls.",
        "tool_calls": [
            {
                "id": "call_edit1",
                "type": "function",
                "function": {
                    "name": "edit_code",
                    "arguments": json.dumps({
                        "old_code": "# placeholder",
                        "new_code": "place_block('stone', 0, 0, 0)",
                    }),
                },
                "thought_signature": None,
                "extra_content": {},
            },
            {
                "id": "call_complete1",
                "type": "function",
                "function": {
                    "name": "complete_task",
                    "arguments": json.dumps({"message": "Done!"}),
                },
                "thought_signature": None,
                "extra_content": {},
            },
        ],
    }


@pytest.fixture
def tool_result_message():
    """Tool result message"""
    return {
        "role": "tool",
        "tool_call_id": "call_abc123",
        "name": "read_code",
        "content": json.dumps({"result": "# Current code here"}),
    }


@pytest.fixture
def full_conversation(
    simple_user_message,
    assistant_with_tool_call,
    tool_result_message,
    simple_assistant_message,
):
    """A complete conversation with user, assistant, tool call, tool result"""
    return [
        simple_user_message,
        assistant_with_tool_call,
        tool_result_message,
        {**simple_assistant_message, "content": "I've read the code. Here's my plan..."},
    ]


# =============================================================================
# Anthropic conversion tests
# =============================================================================

class TestAnthropicMessageConversion:
    """Test Anthropic message format conversion"""

    @pytest.fixture
    def service(self):
        """Create Anthropic service (doesn't need real API key for conversion tests)"""
        return AnthropicService(model_id="claude-sonnet-4-20250514")

    def test_convert_simple_user_message(self, service, simple_user_message):
        """User messages should convert directly"""
        result = service._convert_messages([simple_user_message])

        assert len(result) == 1
        assert result[0]["role"] == "user"
        assert result[0]["content"] == "Build me a house"

    def test_convert_simple_assistant_message(self, service, simple_assistant_message):
        """Assistant text should become a text block"""
        result = service._convert_messages([simple_assistant_message])

        assert len(result) == 1
        assert result[0]["role"] == "assistant"
        assert isinstance(result[0]["content"], list)
        assert len(result[0]["content"]) == 1
        assert result[0]["content"][0]["type"] == "text"
        assert result[0]["content"][0]["text"] == "I'll build you a nice wooden house."

    def test_convert_assistant_with_thinking(self, service, assistant_with_thinking):
        """Assistant with thinking should have thinking block first"""
        result = service._convert_messages([assistant_with_thinking])

        assert len(result) == 1
        assert result[0]["role"] == "assistant"
        content = result[0]["content"]

        # Thinking block should come first
        assert content[0]["type"] == "thinking"
        assert "oak wood" in content[0]["thinking"]

        # Text block should come second
        assert content[1]["type"] == "text"
        assert "cozy cottage" in content[1]["text"]

    def test_convert_assistant_with_tool_call(self, service, assistant_with_tool_call):
        """Assistant with tool calls should have thinking + tool_use blocks"""
        result = service._convert_messages([assistant_with_tool_call])

        assert len(result) == 1
        assert result[0]["role"] == "assistant"
        content = result[0]["content"]

        # Should have thinking block first (required by Anthropic)
        assert content[0]["type"] == "thinking"

        # Then tool_use block
        tool_use = content[1]
        assert tool_use["type"] == "tool_use"
        assert tool_use["id"] == "call_abc123"
        assert tool_use["name"] == "read_code"

    def test_convert_tool_result(self, service, assistant_with_tool_call, tool_result_message):
        """Tool results should become user messages with tool_result content"""
        messages = [assistant_with_tool_call, tool_result_message]
        result = service._convert_messages(messages)

        # Should have assistant message and user message with tool result
        assert len(result) == 2
        assert result[0]["role"] == "assistant"
        assert result[1]["role"] == "user"

        # User message should have tool_result content
        assert isinstance(result[1]["content"], list)
        tool_result = result[1]["content"][0]
        assert tool_result["type"] == "tool_result"
        assert tool_result["tool_use_id"] == "call_abc123"

    def test_convert_multiple_tool_calls(self, service, assistant_with_multiple_tool_calls):
        """Multiple tool calls should all be converted"""
        result = service._convert_messages([assistant_with_multiple_tool_calls])

        content = result[0]["content"]

        # Should have: thinking, text, tool_use, tool_use
        types = [block["type"] for block in content]
        assert types[0] == "thinking"
        assert types[1] == "text"
        assert types[2] == "tool_use"
        assert types[3] == "tool_use"

        # Check tool call details
        assert content[2]["name"] == "edit_code"
        assert content[3]["name"] == "complete_task"

    def test_convert_full_conversation(self, service, full_conversation):
        """Full conversation should maintain correct structure"""
        result = service._convert_messages(full_conversation)

        # Should alternate correctly: user, assistant, user (tool result), assistant
        roles = [msg["role"] for msg in result]
        assert roles == ["user", "assistant", "user", "assistant"]

    def test_assistant_without_thinking_no_thinking_block(self, service, simple_assistant_message):
        """Assistant without thought_summary should not have thinking block"""
        result = service._convert_messages([simple_assistant_message])

        content = result[0]["content"]
        types = [block["type"] for block in content]
        assert "thinking" not in types

    def test_empty_tool_arguments(self, service):
        """Tool calls with empty arguments should be handled"""
        message = {
            "role": "assistant",
            "content": "",
            "thought_summary": "Reading code",
            "tool_calls": [
                {
                    "id": "call_123",
                    "type": "function",
                    "function": {
                        "name": "read_code",
                        "arguments": "",  # Empty string
                    },
                }
            ],
        }
        result = service._convert_messages([message])

        tool_use = result[0]["content"][1]  # After thinking block
        assert tool_use["type"] == "tool_use"
        assert tool_use["input"] == {}  # Should be empty dict, not error


# =============================================================================
# Gemini conversion tests
# =============================================================================

class TestGeminiMessageConversion:
    """Test Gemini message format conversion"""

    @pytest.fixture
    def service(self):
        """Create Gemini service"""
        return GeminiService(model_id="gemini-2.5-flash")

    def test_convert_simple_user_message(self, service, simple_user_message):
        """User messages should become Content with user role"""
        result = service._convert_messages([simple_user_message])

        assert len(result) == 1
        assert result[0].role == "user"
        assert len(result[0].parts) == 1
        assert result[0].parts[0].text == "Build me a house"

    def test_convert_simple_assistant_message(self, service, simple_assistant_message):
        """Assistant messages should become Content with model role"""
        result = service._convert_messages([simple_assistant_message])

        assert len(result) == 1
        assert result[0].role == "model"
        assert result[0].parts[0].text == "I'll build you a nice wooden house."

    def test_convert_assistant_with_tool_call(self, service, assistant_with_tool_call):
        """Assistant with tool calls should have FunctionCall parts"""
        result = service._convert_messages([assistant_with_tool_call])

        assert len(result) == 1
        assert result[0].role == "model"

        # Should have a FunctionCall part
        parts = result[0].parts
        function_call_parts = [p for p in parts if hasattr(p, 'function_call') and p.function_call]
        assert len(function_call_parts) >= 1

    def test_convert_tool_result(self, service, assistant_with_tool_call, tool_result_message):
        """Tool results should become FunctionResponse parts"""
        messages = [assistant_with_tool_call, tool_result_message]
        result = service._convert_messages(messages)

        # Should have model message and user message with function response
        assert len(result) == 2
        assert result[0].role == "model"
        assert result[1].role == "user"


# =============================================================================
# Cross-provider compatibility tests
# =============================================================================

class TestCrossProviderCompatibility:
    """Test that messages can flow between providers"""

    @pytest.fixture
    def anthropic_service(self):
        return AnthropicService(model_id="claude-sonnet-4-20250514")

    @pytest.fixture
    def gemini_service(self):
        return GeminiService(model_id="gemini-2.5-flash")

    def test_user_message_converts_for_all_providers(
        self, anthropic_service, gemini_service, simple_user_message
    ):
        """Simple user message should work for all providers"""
        # Both should convert without error
        anthropic_result = anthropic_service._convert_messages([simple_user_message])
        gemini_result = gemini_service._convert_messages([simple_user_message])

        assert len(anthropic_result) == 1
        assert len(gemini_result) == 1

    def test_thinking_required_for_anthropic(self, anthropic_service, assistant_with_tool_call):
        """Anthropic requires thinking block when thinking is enabled"""
        result = anthropic_service._convert_messages([assistant_with_tool_call])

        content = result[0]["content"]
        # First block must be thinking for Anthropic
        assert content[0]["type"] == "thinking"

    def test_conversation_with_tools_converts_for_all(
        self, anthropic_service, gemini_service, full_conversation
    ):
        """Full conversation with tools should convert for all providers"""
        # Both should convert without error
        anthropic_result = anthropic_service._convert_messages(full_conversation)
        gemini_result = gemini_service._convert_messages(full_conversation)

        assert len(anthropic_result) >= 1
        assert len(gemini_result) >= 1


# =============================================================================
# Edge case tests
# =============================================================================

class TestEdgeCases:
    """Test edge cases and error handling"""

    @pytest.fixture
    def anthropic_service(self):
        return AnthropicService(model_id="claude-sonnet-4-20250514")

    def test_null_tool_call_id_handled(self, anthropic_service):
        """Messages with null tool_call_id should be handled"""
        message = {
            "role": "assistant",
            "content": "",
            "thought_summary": "Thinking...",
            "tool_calls": [
                {
                    "id": None,  # Null ID (from Gemini)
                    "type": "function",
                    "function": {
                        "name": "read_code",
                        "arguments": "{}",
                    },
                }
            ],
        }
        # Should not raise
        result = anthropic_service._convert_messages([message])
        assert len(result) == 1

    def test_empty_content_handled(self, anthropic_service):
        """Messages with empty content should be handled"""
        message = {
            "role": "assistant",
            "content": "",  # Empty
            "thought_summary": "Just thinking",
            "tool_calls": None,
        }
        result = anthropic_service._convert_messages([message])

        # Should still have thinking block
        assert len(result) == 1
        assert result[0]["content"][0]["type"] == "thinking"

    def test_thinking_signature_included(self, anthropic_service):
        """Thinking signature should be included when present"""
        message = {
            "role": "assistant",
            "content": "Here's my answer",
            "thought_summary": "Let me think about this",
            "thinking_signature": "abc123signature",
            "tool_calls": None,
        }
        result = anthropic_service._convert_messages([message])

        thinking_block = result[0]["content"][0]
        assert thinking_block["type"] == "thinking"
        assert thinking_block["signature"] == "abc123signature"

    def test_thinking_without_signature(self, anthropic_service):
        """Thinking without signature should not have signature field"""
        message = {
            "role": "assistant",
            "content": "Here's my answer",
            "thought_summary": "Let me think about this",
            "thinking_signature": None,
            "tool_calls": None,
        }
        result = anthropic_service._convert_messages([message])

        thinking_block = result[0]["content"][0]
        assert thinking_block["type"] == "thinking"
        assert "signature" not in thinking_block

    def test_malformed_tool_arguments_handled(self, anthropic_service):
        """Malformed JSON in tool arguments should be handled gracefully"""
        message = {
            "role": "assistant",
            "content": "",
            "thought_summary": "Calling tool",
            "tool_calls": [
                {
                    "id": "call_123",
                    "type": "function",
                    "function": {
                        "name": "edit_code",
                        "arguments": "not valid json {{{",
                    },
                }
            ],
        }
        # Should not raise, should use empty dict
        result = anthropic_service._convert_messages([message])
        tool_use = result[0]["content"][1]
        assert tool_use["input"] == {}


# =============================================================================
# OpenAI sanitization tests
# =============================================================================

class TestOpenAISanitization:
    """Test OpenAI message sanitization for cross-provider compatibility"""

    @pytest.fixture
    def service(self):
        return OpenAIService(model_id="gpt-4o")

    def test_null_tool_call_ids_get_generated(self, service):
        """Null tool call IDs should get generated UUIDs"""
        messages = [
            {"role": "user", "content": "Hello"},
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {
                        "id": None,
                        "type": "function",
                        "function": {"name": "read_code", "arguments": "{}"},
                    }
                ],
            },
            {
                "role": "tool",
                "tool_call_id": None,
                "content": '{"result": "code here"}',
                "name": "read_code",
            },
        ]
        result = service._sanitize_messages(messages)

        # Tool call should have generated ID
        assert result[1]["tool_calls"][0]["id"] is not None
        assert result[1]["tool_calls"][0]["id"].startswith("call_")

        # Tool message should have matching ID
        assert result[2]["tool_call_id"] == result[1]["tool_calls"][0]["id"]

    def test_existing_ids_preserved(self, service):
        """Existing valid IDs should be preserved"""
        messages = [
            {"role": "user", "content": "Hello"},
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {
                        "id": "call_existing123",
                        "type": "function",
                        "function": {"name": "read_code", "arguments": "{}"},
                    }
                ],
            },
            {
                "role": "tool",
                "tool_call_id": "call_existing123",
                "content": '{"result": "code here"}',
                "name": "read_code",
            },
        ]
        result = service._sanitize_messages(messages)

        # IDs should be unchanged
        assert result[1]["tool_calls"][0]["id"] == "call_existing123"
        assert result[2]["tool_call_id"] == "call_existing123"

    def test_multiple_tool_calls_matched(self, service):
        """Multiple tool calls should match with their results in order"""
        messages = [
            {"role": "user", "content": "Hello"},
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {
                        "id": None,
                        "type": "function",
                        "function": {"name": "read_code", "arguments": "{}"},
                    },
                    {
                        "id": None,
                        "type": "function",
                        "function": {"name": "edit_code", "arguments": "{}"},
                    },
                ],
            },
            {
                "role": "tool",
                "tool_call_id": None,
                "content": '{"result": "code"}',
                "name": "read_code",
            },
            {
                "role": "tool",
                "tool_call_id": None,
                "content": '{"result": "edited"}',
                "name": "edit_code",
            },
        ]
        result = service._sanitize_messages(messages)

        # Each tool message should match its corresponding tool call
        tool_call_1_id = result[1]["tool_calls"][0]["id"]
        tool_call_2_id = result[1]["tool_calls"][1]["id"]

        assert result[2]["tool_call_id"] == tool_call_1_id
        assert result[3]["tool_call_id"] == tool_call_2_id
        assert tool_call_1_id != tool_call_2_id

"""
Anthropic API service with streaming tool support and extended thinking.
"""

import json
from typing import AsyncIterator

import anthropic

from app.agent.llms.base import BaseDeclarativeLLMService, StreamChunk
from app.config import settings


class AnthropicService(BaseDeclarativeLLMService):
    """Service for interacting with Anthropic Claude API."""

    def __init__(self, model_id: str):
        super().__init__(model_id)
        self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    def _convert_tools(self, tools: list[dict]) -> list[dict]:
        """Convert OpenAI-style tool specs to Anthropic format."""
        anthropic_tools = []
        for tool in tools or []:
            func_def = tool.get("function") if isinstance(tool, dict) else None
            if not func_def:
                continue

            anthropic_tools.append(
                {
                    "name": func_def.get("name", ""),
                    "description": func_def.get("description", ""),
                    "input_schema": func_def.get("parameters", {}),
                }
            )
        return anthropic_tools

    def _convert_messages(self, messages: list[dict]) -> list[dict]:
        """Convert OpenAI-format messages to Anthropic format."""
        anthropic_messages = []

        for msg in messages:
            role = msg.get("role")

            if role == "user":
                anthropic_messages.append({"role": "user", "content": msg.get("content", "")})

            elif role == "assistant":
                content_blocks = []

                # Add text content if present
                if msg.get("content"):
                    content_blocks.append({"type": "text", "text": msg["content"]})

                # Convert tool_calls to tool_use blocks
                for tool_call in msg.get("tool_calls") or []:
                    func = tool_call.get("function", {})
                    try:
                        input_data = json.loads(func.get("arguments", "{}"))
                    except json.JSONDecodeError:
                        input_data = {}

                    content_blocks.append(
                        {
                            "type": "tool_use",
                            "id": tool_call.get("id", ""),
                            "name": func.get("name", ""),
                            "input": input_data,
                        }
                    )

                if content_blocks:
                    anthropic_messages.append({"role": "assistant", "content": content_blocks})

            elif role == "tool":
                # Tool results go in a user message with tool_result content
                tool_result = {
                    "type": "tool_result",
                    "tool_use_id": msg.get("tool_call_id", ""),
                    "content": msg.get("content", ""),
                }

                # Check if we can append to existing user message with tool_results
                if (
                    anthropic_messages
                    and anthropic_messages[-1].get("role") == "user"
                    and isinstance(anthropic_messages[-1].get("content"), list)
                ):
                    anthropic_messages[-1]["content"].append(tool_result)
                else:
                    anthropic_messages.append({"role": "user", "content": [tool_result]})

        return anthropic_messages

    async def generate_with_tools_streaming(
        self,
        system_prompt: str,
        messages: list[dict],
        tools: list[dict],
    ) -> AsyncIterator[StreamChunk]:
        """
        Stream responses from Anthropic with tool calling and extended thinking.

        Args:
            system_prompt: System instructions
            messages: Conversation history in OpenAI format
            tools: Tool definitions in OpenAI format
        """
        anthropic_tools = self._convert_tools(tools)
        anthropic_messages = self._convert_messages(messages)

        # Build request params
        request_params = {
            "model": self.model_id,
            "system": system_prompt,
            "messages": anthropic_messages,
            "max_tokens": 16000,
        }

        # Add tools if present
        if anthropic_tools:
            request_params["tools"] = anthropic_tools

        # Enable extended thinking for supported models
        if "claude-3" in self.model_id or "claude-sonnet-4" in self.model_id:
            request_params["thinking"] = {
                "type": "enabled",
                "budget_tokens": 10000,
            }

        # Track current block type and accumulate tool input
        current_block_type = None
        current_tool_id = None
        current_tool_name = None
        current_tool_input = ""
        tool_index = 0

        async with self.client.messages.stream(**request_params) as stream:
            async for event in stream:
                event_type = event.type

                if event_type == "content_block_start":
                    block = event.content_block
                    current_block_type = block.type

                    if block.type == "tool_use":
                        current_tool_id = block.id
                        current_tool_name = block.name
                        current_tool_input = ""

                elif event_type == "content_block_delta":
                    delta = event.delta

                    if current_block_type == "thinking":
                        # Stream thinking content
                        if hasattr(delta, "thinking"):
                            yield StreamChunk(thought_delta=delta.thinking)

                    elif current_block_type == "text":
                        # Stream text content
                        if hasattr(delta, "text"):
                            yield StreamChunk(text_delta=delta.text)

                    elif current_block_type == "tool_use":
                        # Accumulate tool input JSON
                        if hasattr(delta, "partial_json"):
                            current_tool_input += delta.partial_json

                elif event_type == "content_block_stop":
                    # Emit accumulated tool call when block ends
                    if current_block_type == "tool_use" and current_tool_name:
                        yield StreamChunk(
                            tool_calls_delta=[
                                {
                                    "index": tool_index,
                                    "id": current_tool_id,
                                    "type": "function",
                                    "thought_signature": None,
                                    "extra_content": {},
                                    "function": {
                                        "name": current_tool_name,
                                        "arguments": current_tool_input,
                                    },
                                }
                            ]
                        )
                        tool_index += 1

                    current_block_type = None
                    current_tool_id = None
                    current_tool_name = None
                    current_tool_input = ""

                elif event_type == "message_delta":
                    # Message is complete
                    stop_reason = getattr(event.delta, "stop_reason", None)
                    if stop_reason:
                        yield StreamChunk(finish_reason=stop_reason)

"""
OpenAI API service with streaming tool support and reasoning tokens.
"""

import uuid
from typing import AsyncIterator

import openai

from app.agent.llms.base import BaseLLMService, StreamChunk
from app.config import settings

# Models that support reasoning tokens
REASONING_MODELS = ("gpt-5", "o1", "o3", "o4")


class OpenAIService(BaseLLMService):
    """Service for interacting with OpenAI API."""

    def __init__(self, model_id: str = "gpt-5.1"):
        super().__init__(model_id)
        self.client = openai.AsyncOpenAI(api_key=settings.openai_api_key)

    def _is_reasoning_model(self) -> bool:
        """Check if the model supports reasoning tokens."""
        return any(self.model_id.startswith(prefix) for prefix in REASONING_MODELS)

    def _sanitize_messages(self, messages: list[dict]) -> list[dict]:
        """
        Sanitize messages for OpenAI compatibility.

        OpenAI requires tool_call IDs to be non-null strings. Legacy conversations
        from other providers (like Gemini) may have null IDs. This generates
        consistent IDs and ensures tool messages reference the correct IDs.
        """
        sanitized = []
        # Track tool call IDs from the most recent assistant message
        pending_tool_call_ids: list[str] = []

        for msg in messages:
            msg_copy = dict(msg)

            # Sanitize tool_calls in assistant messages
            if msg_copy.get("role") == "assistant" and msg_copy.get("tool_calls"):
                pending_tool_call_ids = []
                sanitized_tool_calls = []
                for tc in msg_copy["tool_calls"]:
                    tc_copy = dict(tc)
                    if not tc_copy.get("id"):
                        tc_copy["id"] = f"call_{uuid.uuid4().hex[:24]}"
                    pending_tool_call_ids.append(tc_copy["id"])
                    sanitized_tool_calls.append(tc_copy)
                msg_copy["tool_calls"] = sanitized_tool_calls

            # Sanitize tool_call_id in tool messages - use IDs from pending list
            if msg_copy.get("role") == "tool":
                if not msg_copy.get("tool_call_id") and pending_tool_call_ids:
                    msg_copy["tool_call_id"] = pending_tool_call_ids.pop(0)
                elif not msg_copy.get("tool_call_id"):
                    msg_copy["tool_call_id"] = f"call_{uuid.uuid4().hex[:24]}"

            sanitized.append(msg_copy)

        return sanitized

    async def generate_with_tools_streaming(
        self,
        system_prompt: str,
        messages: list[dict],
        tools: list[dict],
    ) -> AsyncIterator[StreamChunk]:
        """
        Stream responses from OpenAI with tool calling and reasoning support.

        Args:
            system_prompt: System instructions
            messages: Conversation history in OpenAI format
            tools: Tool definitions in OpenAI format
        """
        # Sanitize and build messages with system prompt
        sanitized = self._sanitize_messages(messages)
        full_messages = [{"role": "system", "content": system_prompt}] + sanitized

        # Build request params
        request_params = {
            "model": self.model_id,
            "messages": full_messages,
            "stream": True,
        }

        # Add tools if present
        if tools:
            request_params["tools"] = tools

        # Enable reasoning for supported models
        if self._is_reasoning_model():
            request_params["reasoning_effort"] = "medium"

        stream = await self.client.chat.completions.create(**request_params)

        async for chunk in stream:
            if not chunk.choices:
                continue

            choice = chunk.choices[0]
            delta = choice.delta
            finish_reason = choice.finish_reason

            # Extract text delta
            text_delta = (
                delta.content if hasattr(delta, "content") and delta.content else None
            )

            # Extract reasoning/thought delta (GPT-5 and reasoning models)
            thought_delta = None
            if hasattr(delta, "reasoning_content") and delta.reasoning_content:
                thought_delta = delta.reasoning_content
            elif hasattr(delta, "reasoning") and delta.reasoning:
                thought_delta = delta.reasoning

            # Extract tool calls delta
            tool_calls_delta = None
            if hasattr(delta, "tool_calls") and delta.tool_calls:
                tool_calls_delta = []
                for tc_delta in delta.tool_calls:
                    tool_calls_delta.append(
                        {
                            "index": tc_delta.index
                            if hasattr(tc_delta, "index")
                            else 0,
                            "id": tc_delta.id if hasattr(tc_delta, "id") else None,
                            "type": "function",
                            "thought_signature": None,
                            "extra_content": {},
                            "function": {
                                "name": (
                                    tc_delta.function.name
                                    if hasattr(tc_delta, "function")
                                    and hasattr(tc_delta.function, "name")
                                    else None
                                ),
                                "arguments": (
                                    tc_delta.function.arguments
                                    if hasattr(tc_delta, "function")
                                    and hasattr(tc_delta.function, "arguments")
                                    else None
                                ),
                            },
                        }
                    )

            # Only yield if we have something
            if text_delta or thought_delta or tool_calls_delta or finish_reason:
                yield StreamChunk(
                    text_delta=text_delta,
                    thought_delta=thought_delta,
                    tool_calls_delta=tool_calls_delta,
                    finish_reason=finish_reason,
                )

"""
OpenAI API service with streaming tool support and reasoning tokens.
"""

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
        full_messages = [{"role": "system", "content": system_prompt}] + messages

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

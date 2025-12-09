"""
Provider-agnostic LLM service using LiteLLM
Supports OpenAI, Anthropic, and Google Gemini
"""

import logging
import os
from typing import AsyncIterator

import litellm

from app.agent.llms.base import BaseLLMService, StreamChunk
from app.config import settings

logger = logging.getLogger(__name__)


class LLMService(BaseLLMService):
    """Provider-agnostic LLM service using LiteLLM"""

    def __init__(self, model_id: str | None = None):
        super().__init__(model_id or settings.llm_model)
        self._configure_api_keys()
        logger.info(f"Using model: {self.model_id}")

    def _configure_api_keys(self):
        """Set API keys as environment variables for LiteLLM"""
        if settings.openai_api_key:
            os.environ["OPENAI_API_KEY"] = settings.openai_api_key
        if settings.anthropic_api_key:
            os.environ["ANTHROPIC_API_KEY"] = settings.anthropic_api_key
        if settings.gemini_api_key:
            os.environ["GEMINI_API_KEY"] = settings.gemini_api_key

    async def generate_with_tools_streaming(
        self,
        system_prompt: str,
        messages: list[dict],
        tools: list[dict],
    ) -> AsyncIterator[StreamChunk]:
        """
        Call LLM with function/tool calling enabled, streaming response.

        Args:
            system_prompt: System instructions
            messages: Conversation history in OpenAI format
                [{"role": "user"|"assistant"|"tool", "content": str, ...}]
            tools: Available tools in OpenAI function calling format

        Yields:
            StreamChunk with text deltas, tool call deltas, or finish reason
        """
        # Build messages with system prompt
        full_messages = [{"role": "system", "content": system_prompt}] + messages

        # Call LiteLLM with streaming enabled
        response = await litellm.acompletion(
            model=self.model_id,
            messages=full_messages,
            tools=tools,
            stream=True,
        )

        # Stream chunks
        async for chunk in response:
            if not chunk.choices:
                continue

            delta = chunk.choices[0].delta
            finish_reason = chunk.choices[0].finish_reason

            # Extract text delta
            text_delta = delta.content if hasattr(delta, "content") else None

            # Extract tool calls delta
            tool_calls_delta = None
            if hasattr(delta, "tool_calls") and delta.tool_calls:
                tool_calls_delta = []
                for tc_delta in delta.tool_calls:
                    tool_calls_delta.append(
                        {
                            "index": tc_delta.index if hasattr(tc_delta, "index") else None,
                            "id": tc_delta.id if hasattr(tc_delta, "id") else None,
                            "type": tc_delta.type if hasattr(tc_delta, "type") else None,
                            "function": {
                                "name": tc_delta.function.name
                                if hasattr(tc_delta, "function")
                                and hasattr(tc_delta.function, "name")
                                else None,
                                "arguments": tc_delta.function.arguments
                                if hasattr(tc_delta, "function")
                                and hasattr(tc_delta.function, "arguments")
                                else None,
                            },
                        }
                    )

            yield StreamChunk(
                text_delta=text_delta,
                tool_calls_delta=tool_calls_delta,
                finish_reason=finish_reason,
            )

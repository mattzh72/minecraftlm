"""
Base classes and shared types for LLM services.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncIterator


@dataclass
class StreamChunk:
    """Shared streaming chunk type for all LLM providers."""

    text_delta: str | None = None
    thought_delta: str | None = None  # Reasoning/thinking tokens
    tool_calls_delta: list[dict] | None = None
    finish_reason: str | None = None


class BaseDeclarativeLLMService(ABC):
    """Base class for LLM services that can be called with tools."""

    def __init__(self, model_id: str):
        self.model_id = model_id

    @abstractmethod
    async def generate_with_tools_streaming(
        self,
        system_prompt: str,
        messages: list[dict],
        tools: list[dict],
    ) -> AsyncIterator[StreamChunk]:
        """
        Stream responses from the LLM with tool calling support.

        Args:
            system_prompt: System instructions
            messages: Conversation history in OpenAI format
            tools: Tool definitions in OpenAI format

        Yields:
            StreamChunk with text deltas, thought deltas, tool call deltas, or finish reason
        """
        ...

"""
Provider-agnostic LLM service using LiteLLM
Supports OpenAI, Anthropic, and Google Gemini
"""

import logging
import os
from dataclasses import dataclass

import litellm

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class FunctionCall:
    """Normalized function call from any provider"""

    name: str
    args: dict
    id: str | None = None


@dataclass
class ModelResponse:
    """Normalized response from any provider"""

    text: str | None
    function_calls: list[FunctionCall] | None
    finish_reason: str | None


class LLMService:
    """Provider-agnostic LLM service using LiteLLM"""

    def __init__(self):
        self.model = settings.get_model()
        self._configure_api_keys()
        logger.info(f"Using model: {self.model}")

    def _configure_api_keys(self):
        """Set API keys as environment variables for LiteLLM"""
        if settings.openai_api_key:
            os.environ["OPENAI_API_KEY"] = settings.openai_api_key
        if settings.anthropic_api_key:
            os.environ["ANTHROPIC_API_KEY"] = settings.anthropic_api_key
        if settings.gemini_api_key:
            os.environ["GEMINI_API_KEY"] = settings.gemini_api_key

    def generate_with_tools(
        self,
        system_prompt: str,
        messages: list[dict],
        tools: list[dict],
    ) -> ModelResponse:
        """
        Call LLM with function/tool calling enabled.

        Args:
            system_prompt: System instructions
            messages: Conversation history in OpenAI format
                [{"role": "user"|"assistant"|"tool", "content": str, ...}]
            tools: Available tools in OpenAI function calling format

        Returns:
            ModelResponse with text and/or function_calls
        """
        # Build messages with system prompt
        full_messages = [{"role": "system", "content": system_prompt}] + messages

        # Call LiteLLM
        response = litellm.completion(
            model=self.model,
            messages=full_messages,
            tools=tools,
            temperature=1.0,
        )

        # Extract response
        choice = response.choices[0]
        message = choice.message

        # Extract text
        text = message.content

        # Extract function calls
        function_calls = None
        if message.tool_calls:
            function_calls = []
            for tool_call in message.tool_calls:
                func = tool_call.function
                # Parse args from JSON string
                import json

                args = json.loads(func.arguments) if func.arguments else {}
                function_calls.append(
                    FunctionCall(
                        name=func.name,
                        args=args,
                        id=tool_call.id,
                    )
                )

        return ModelResponse(
            text=text,
            function_calls=function_calls,
            finish_reason=choice.finish_reason,
        )

"""
Gemini API service
"""

from dataclasses import dataclass
from typing import AsyncIterator

from google import genai
from google.genai import types
from google.genai.types import Content, FunctionCall, FunctionDeclaration, Part

from app.config import settings


@dataclass
class ModelResponse:
    """Response from Gemini model"""

    text: str | None
    function_calls: list[FunctionCall] | None
    finish_reason: str | None
    thought_signatures: list[bytes | None] | None = None


class GeminiService:
    """Service for interacting with Gemini API"""

    def __init__(self):
        self.client = genai.Client(api_key=settings.gemini_api_key)
        self.model_id = "gemini-3-pro-preview"

    def generate_with_tools(
        self,
        system_prompt: str,
        contents: list[Content],
        tools: list[FunctionDeclaration],
    ) -> ModelResponse:
        """
        Call Gemini with function calling enabled.

        Args:
            system_prompt: System instructions
            contents: Conversation history in Gemini format
            tools: Available tools as FunctionDeclarations

        Returns:
            ModelResponse with text and/or function_calls
        """
        # Wrap all FunctionDeclarations in a single Tool object (like gemini-cli does)
        tool_list = [types.Tool(function_declarations=tools)]

        # Configure with tools using AUTO mode (default, like gemini-cli)
        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=1.0,
            tools=tool_list,
        )

        # Call model
        response = self.client.models.generate_content(
            model=self.model_id, contents=contents, config=config
        )

        # Extract response parts
        text_parts = []
        function_calls = []
        thought_signatures = []

        if response.candidates and len(response.candidates) > 0:
            candidate = response.candidates[0]

            if candidate.content and candidate.content.parts:
                for part in candidate.content.parts:
                    if hasattr(part, "text") and part.text:
                        text_parts.append(part.text)
                    if hasattr(part, "function_call") and part.function_call:
                        function_calls.append(part.function_call)
                        # Extract thought signature if present (needed for Gemini 3)
                        if hasattr(part, "thought_signature") and part.thought_signature:
                            thought_signatures.append(part.thought_signature)
                        else:
                            thought_signatures.append(None)

            finish_reason = candidate.finish_reason if hasattr(candidate, "finish_reason") else None
        else:
            finish_reason = None

        return ModelResponse(
            text="".join(text_parts) if text_parts else None,
            function_calls=function_calls if function_calls else None,
            finish_reason=finish_reason,
            thought_signatures=thought_signatures if thought_signatures else None,
        )

    async def generate_stream(
        self, system_prompt: str, conversation: list[dict]
    ) -> AsyncIterator[str]:
        """
        Stream responses from Gemini API (for simple streaming without tools).

        Args:
            system_prompt: System instructions for the model
            conversation: List of messages [{"role": "user"|"model", "content": str}]

        Yields:
            Response chunks as they're generated
        """
        # Format messages for Gemini API
        formatted = []
        for message in conversation:
            formatted.append(
                Content(role=message["role"], parts=[Part(text=message["content"])])
            )

        # Configure generation with system instructions
        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=1.0,  # Keep at default for Gemini 3
        )

        # Stream response
        response = self.client.models.generate_content_stream(
            model=self.model_id, contents=formatted, config=config
        )

        # Yield text chunks as they arrive
        for chunk in response:
            if chunk.text:
                yield chunk.text

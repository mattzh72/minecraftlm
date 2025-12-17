"""
Gemini API service with streaming tool support.
"""

import base64
import json
import uuid
from typing import AsyncIterator

from google import genai
from google.genai import types
from google.genai.types import Content, FunctionCall, FunctionDeclaration, Part

from app.agent.llms.base import BaseLLMService, StreamChunk, ThinkingLevel
from app.config import settings

# Thinking budget mapping for Gemini 2.5 series models
GEMINI_THINKING_BUDGETS = {
    "low": 1024,
    "med": 8192,
    "high": 24576,
}

# Thinking level mapping for Gemini 3+ models
GEMINI_THINKING_LEVELS = {
    "low": "low",
    "med": "high",  # Map medium to high for Gemini 3+
    "high": "high",
}


class GeminiService(BaseLLMService):
    """Service for interacting with Gemini API."""

    def __init__(
        self,
        model_id: str = "gemini-3-pro-preview",
        thinking_level: ThinkingLevel = "med",
    ):
        # Strip gemini/ prefix if present (used for provider routing)
        clean_model_id = model_id.removeprefix("gemini/")
        super().__init__(clean_model_id, thinking_level)
        self.client = genai.Client(api_key=settings.gemini_api_key)

    def _is_gemini_3_or_later(self) -> bool:
        """Check if the model is Gemini 3 or later (supports thinkingLevel)."""
        model_lower = self.model_id.lower()
        return "gemini-3" in model_lower or "gemini3" in model_lower

    def _convert_tools(self, tools: list[dict]) -> list[FunctionDeclaration]:
        """Convert OpenAI-style tool specs into Gemini FunctionDeclarations."""
        declarations: list[FunctionDeclaration] = []
        for tool in tools or []:
            func_def = tool.get("function") if isinstance(tool, dict) else None
            if not func_def:
                continue

            # Copy parameters and strip additionalProperties (not supported by Gemini)
            parameters = func_def.get("parameters")
            if parameters and isinstance(parameters, dict):
                parameters = {
                    k: v for k, v in parameters.items() if k != "additionalProperties"
                }

            declarations.append(
                FunctionDeclaration(
                    name=func_def.get("name", ""),
                    description=func_def.get("description", ""),
                    parameters=parameters,
                )
            )
        return declarations

    @staticmethod
    def _convert_arguments(args: str | dict | list | None):
        """Parse JSON strings to dicts for function arguments/responses."""
        if args is None:
            return {}
        if isinstance(args, (dict, list)):
            return args
        # args is a string that needs to be parsed as JSON
        return json.loads(args)

    @staticmethod
    def _encode_signature(signature: bytes | str | None) -> str | None:
        """Encode bytes signature to base64 string for JSON serialization."""
        if signature is None:
            return None
        if isinstance(signature, bytes):
            return base64.b64encode(signature).decode("utf-8")
        return signature

    @staticmethod
    def _decode_signature(signature: str | bytes | None) -> bytes | None:
        """Decode base64 string back to bytes for Gemini API."""
        if signature is None:
            return None
        if isinstance(signature, bytes):
            return signature
        return base64.b64decode(signature)

    def _convert_message(self, message: dict) -> Content:
        """Translate OpenAI-formatted messages to Gemini Content objects."""
        role = message.get("role", "user")
        if role == "assistant":
            role = "model"

        parts: list[Part] = []

        # Assistant messages that contain tool calls
        if role == "model" and message.get("tool_calls"):
            if message.get("content"):
                parts.append(Part(text=message["content"]))
            for tool_call in message.get("tool_calls", []):
                function = (
                    tool_call.get("function", {}) if isinstance(tool_call, dict) else {}
                )
                signature = None
                if isinstance(tool_call, dict):
                    raw_signature = tool_call.get("thought_signature") or tool_call.get(
                        "extra_content", {}
                    ).get("google", {}).get("thought_signature")
                    signature = self._decode_signature(raw_signature)
                fn_call = FunctionCall(
                    name=function.get("name", ""),
                    args=self._convert_arguments(function.get("arguments")),
                )
                parts.append(Part(function_call=fn_call, thought_signature=signature))

        # Tool responses are treated as user-provided function responses
        elif message.get("role") == "tool":
            response_body = self._convert_arguments(message.get("content"))
            parts.append(
                Part(
                    function_response=types.FunctionResponse(
                        name=message.get("name") or message.get("tool_call_id", ""),
                        response=response_body,
                    )
                )
            )
            role = "user"

        # Standard text content
        elif message.get("content"):
            parts.append(Part(text=message["content"]))

        if not parts:
            raise ValueError("Message must contain content or tool calls")

        return Content(role=role, parts=parts)

    def _convert_messages(self, messages: list[dict]) -> list[Content]:
        """Convert conversation history into Gemini Content list."""
        return [self._convert_message(msg) for msg in messages]

    async def generate_with_tools_streaming(
        self,
        system_prompt: str,
        messages: list[dict],
        tools: list[dict],
    ) -> AsyncIterator[StreamChunk]:
        """
        Stream responses from Gemini with tool calling and thought summaries enabled.

        Args:
            system_prompt: System instructions
            messages: Conversation history in OpenAI format
            tools: Tool definitions in OpenAI format
        """
        tool_declarations = self._convert_tools(tools)
        contents = self._convert_messages(messages)

        # Validate thinking level
        if self.thinking_level not in GEMINI_THINKING_BUDGETS:
            raise ValueError(f"Invalid thinking level: {self.thinking_level}")

        # Build thinking config based on model version
        if self._is_gemini_3_or_later():
            # Gemini 3+ models use thinkingLevel parameter
            thinking_config = types.ThinkingConfig(
                include_thoughts=True,
                thinking_level=GEMINI_THINKING_LEVELS[self.thinking_level],
            )
        else:
            # Gemini 2.5 and earlier use thinkingBudget parameter
            thinking_config = types.ThinkingConfig(
                include_thoughts=True,
                thinking_budget=GEMINI_THINKING_BUDGETS[self.thinking_level],
            )

        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            tools=[types.Tool(function_declarations=tool_declarations)]
            if tool_declarations
            else None,
            thinking_config=thinking_config,
            temperature=1.0,
        )

        stream = await self.client.aio.models.generate_content_stream(
            model=self.model_id,
            contents=contents,
            config=config,
        )

        async for chunk in stream:
            if not getattr(chunk, "candidates", None):
                continue

            candidate = chunk.candidates[0]
            finish_reason = getattr(candidate, "finish_reason", None)
            text_delta = ""
            thought_delta = ""
            tool_calls_delta: list[dict] = []

            parts = candidate.content.parts if candidate.content else []
            for part in parts:
                # Capture text and thought summaries separately
                if getattr(part, "text", None):
                    if getattr(part, "thought", False):
                        thought_delta += part.text
                    else:
                        text_delta += part.text

                function_call = getattr(part, "function_call", None)
                if function_call:
                    args = getattr(function_call, "args", None)
                    if args is None:
                        args = getattr(function_call, "arguments", None)
                    raw_signature = getattr(part, "thought_signature", None) or getattr(
                        function_call, "thought_signature", None
                    )
                    encoded_signature = self._encode_signature(raw_signature)
                    # Generate stable ID if Gemini doesn't provide one
                    call_id = (
                        getattr(function_call, "id", None) or f"call_{uuid.uuid4().hex}"
                    )
                    tool_calls_delta.append(
                        {
                            "index": len(tool_calls_delta),
                            "id": call_id,
                            "type": "function",
                            "thought_signature": encoded_signature,
                            "extra_content": {
                                "google": {"thought_signature": encoded_signature}
                            }
                            if encoded_signature
                            else {},
                            "function": {
                                "name": getattr(function_call, "name", None),
                                "arguments": (
                                    json.dumps(args)
                                    if isinstance(args, (dict, list))
                                    else str(args)
                                    if args is not None
                                    else ""
                                ),
                            },
                        }
                    )

            if any([text_delta, thought_delta, tool_calls_delta, finish_reason]):
                yield StreamChunk(
                    text_delta=text_delta or None,
                    thought_delta=thought_delta or None,
                    tool_calls_delta=tool_calls_delta or None,
                    finish_reason=finish_reason,
                )

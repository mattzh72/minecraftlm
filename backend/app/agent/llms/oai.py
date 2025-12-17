"""
OpenAI API service with streaming tool support and reasoning using the Responses API.
"""

import uuid
from typing import AsyncIterator

import openai

from app.agent.llms.base import BaseLLMService, StreamChunk, ThinkingLevel
from app.config import settings

# Models that support reasoning
REASONING_MODELS = ("gpt-5", "o1", "o3", "o4")

# Reasoning effort mapping for OpenAI
OPENAI_REASONING_EFFORT = {
    "low": "low",
    "med": "medium",
    "high": "high",
}


class OpenAIService(BaseLLMService):
    """Service for interacting with OpenAI API using the Responses API."""

    def __init__(
        self, model_id: str = "gpt-5.2", thinking_level: ThinkingLevel = "med"
    ):
        super().__init__(model_id, thinking_level)
        self.client = openai.AsyncOpenAI(api_key=settings.openai_api_key)

    def _is_reasoning_model(self) -> bool:
        """Check if the model supports reasoning."""
        return any(self.model_id.startswith(prefix) for prefix in REASONING_MODELS)

    def _convert_tools(self, tools: list[dict]) -> list[dict]:
        """Convert OpenAI Chat Completions tool format to Responses API format."""
        responses_tools = []
        for tool in tools or []:
            func_def = tool.get("function") if isinstance(tool, dict) else None
            if not func_def:
                continue

            responses_tools.append(
                {
                    "type": "function",
                    "name": func_def.get("name", ""),
                    "description": func_def.get("description", ""),
                    "parameters": func_def.get("parameters", {}),
                    "strict": True,
                }
            )
        return responses_tools

    def _convert_messages_to_input(
        self, system_prompt: str, messages: list[dict]
    ) -> list[dict]:
        """Convert OpenAI-format conversation to Responses API input format."""
        input_items = []

        # Add system prompt as instructions (handled separately in Responses API)
        # We'll pass it as the `instructions` parameter instead

        for msg in messages:
            role = msg.get("role")

            if role == "user":
                input_items.append(
                    {
                        "type": "message",
                        "role": "user",
                        "content": [
                            {"type": "input_text", "text": msg.get("content", "")}
                        ],
                    }
                )

            elif role == "assistant":
                # Include reasoning items first (for ZDR mode with encrypted content)
                for reasoning_item in msg.get("reasoning_items") or []:
                    input_items.append(reasoning_item)

                content_parts = []

                # Add text content if present
                if msg.get("content"):
                    content_parts.append(
                        {"type": "output_text", "text": msg["content"]}
                    )

                # Convert tool_calls to function_call items
                for tool_call in msg.get("tool_calls") or []:
                    func = tool_call.get("function", {})
                    call_id = tool_call.get("id") or f"call_{uuid.uuid4().hex}"
                    input_items.append(
                        {
                            "type": "function_call",
                            "call_id": call_id,
                            "name": func.get("name", ""),
                            "arguments": func.get("arguments", "{}"),
                        }
                    )

                # Only add message if it has text content
                if content_parts:
                    input_items.append(
                        {
                            "type": "message",
                            "role": "assistant",
                            "content": content_parts,
                        }
                    )

            elif role == "tool":
                # Tool results are function_call_output items
                tool_call_id = msg.get("tool_call_id") or f"call_{uuid.uuid4().hex}"
                input_items.append(
                    {
                        "type": "function_call_output",
                        "call_id": tool_call_id,
                        "output": msg.get("content", ""),
                    }
                )

        return input_items

    async def generate_with_tools_streaming(
        self,
        system_prompt: str,
        messages: list[dict],
        tools: list[dict],
    ) -> AsyncIterator[StreamChunk]:
        """
        Stream responses from OpenAI using the Responses API with tool calling and reasoning.

        Args:
            system_prompt: System instructions
            messages: Conversation history in OpenAI format
            tools: Tool definitions in OpenAI format
        """
        responses_tools = self._convert_tools(tools)
        input_items = self._convert_messages_to_input(system_prompt, messages)

        # Build request params
        request_params = {
            "model": self.model_id,
            "instructions": system_prompt,
            "input": input_items,
            "stream": True,
            "store": False,  # ZDR mode - disable server-side storage
        }

        # Add tools if present
        if responses_tools:
            request_params["tools"] = responses_tools

        if self._is_reasoning_model():
            if self.thinking_level not in OPENAI_REASONING_EFFORT:
                raise ValueError(f"Invalid thinking level: {self.thinking_level}")

            request_params["reasoning"] = {
                "effort": OPENAI_REASONING_EFFORT[self.thinking_level],
                "summary": "auto",
            }
            # Request encrypted reasoning content for ZDR passback
            request_params["include"] = ["reasoning.encrypted_content"]

        # Track function calls by output_index
        function_calls: dict[int, dict] = {}
        # Track reasoning items for ZDR passback
        reasoning_items: list[dict] = []

        stream = await self.client.responses.create(**request_params)

        async for event in stream:
            event_type = event.type

            # Text content delta
            if event_type == "response.output_text.delta":
                yield StreamChunk(text_delta=event.delta)

            # Reasoning summary delta (thinking)
            elif event_type == "response.reasoning_summary_text.delta":
                yield StreamChunk(thought_delta=event.delta)

            # Function call started - capture ID and name
            elif event_type == "response.output_item.added":
                item = event.item
                if getattr(item, "type", None) == "function_call":
                    output_index = event.output_index
                    function_calls[output_index] = {
                        "id": getattr(item, "call_id", None)
                        or getattr(item, "id", None),
                        "name": getattr(item, "name", ""),
                        "arguments": "",
                    }

            # Function call arguments delta
            elif event_type == "response.function_call_arguments.delta":
                output_index = event.output_index
                if output_index in function_calls:
                    function_calls[output_index]["arguments"] += event.delta

            # Function call arguments complete - emit tool call
            elif event_type == "response.function_call_arguments.done":
                output_index = event.output_index
                if output_index in function_calls:
                    fc = function_calls[output_index]
                    # Generate ID if not provided
                    call_id = fc.get("id") or f"call_{uuid.uuid4().hex}"
                    yield StreamChunk(
                        tool_calls_delta=[
                            {
                                "index": output_index,
                                "id": call_id,
                                "type": "function",
                                "thought_signature": None,
                                "extra_content": {},
                                "function": {
                                    "name": fc.get("name", ""),
                                    "arguments": fc.get("arguments", ""),
                                },
                            }
                        ]
                    )

            # Reasoning item complete - capture for ZDR passback
            elif event_type == "response.output_item.done":
                item = event.item
                if getattr(item, "type", None) == "reasoning":
                    encrypted_content = getattr(item, "encrypted_content", None)
                    if encrypted_content:
                        # Convert summary objects to dicts
                        summary_list = []
                        for s in getattr(item, "summary", []) or []:
                            summary_list.append(
                                {
                                    "type": getattr(s, "type", "summary_text"),
                                    "text": getattr(s, "text", ""),
                                }
                            )
                        reasoning_items.append(
                            {
                                "id": getattr(item, "id", None),
                                "type": "reasoning",
                                "summary": summary_list,
                                "encrypted_content": encrypted_content,
                            }
                        )

            # Response complete
            elif event_type == "response.completed":
                # Yield reasoning items for storage and passback
                if reasoning_items:
                    yield StreamChunk(reasoning_items=reasoning_items)
                yield StreamChunk(finish_reason="stop")

"""Storage schemas for conversation messages"""

import uuid
from typing import Literal, Union

from pydantic import BaseModel, Field


class ToolCallFunction(BaseModel):
    """Function details within a tool call"""

    name: str
    arguments: str


class ToolCall(BaseModel):
    """Tool call made by the assistant"""

    id: str = Field(default_factory=lambda: f"call_{uuid.uuid4().hex}")
    type: Literal["function"]
    function: ToolCallFunction
    thought_signature: str | None = None
    extra_content: dict = {}


class UserMessage(BaseModel):
    """User message in conversation"""

    role: Literal["user"]
    content: str


class AssistantMessage(BaseModel):
    """Assistant message in conversation"""

    role: Literal["assistant"]
    content: str
    thought_summary: str | None = None
    thinking_signature: str | None = None  # Anthropic thinking block signature
    tool_calls: list[ToolCall] | None = None
    reasoning_items: list[dict] | None = None  # Encrypted reasoning for ZDR passback (OpenAI)


class ToolMessage(BaseModel):
    """Tool response message in conversation"""

    role: Literal["tool"]
    tool_call_id: str | None = None
    content: str
    name: str


ConversationMessage = Union[UserMessage, AssistantMessage, ToolMessage]

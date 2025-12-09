"""Storage schemas for conversation messages"""

from typing import Literal, Union

from pydantic import BaseModel


class ToolCallFunction(BaseModel):
    """Function details within a tool call"""

    name: str
    arguments: str


class ToolCall(BaseModel):
    """Tool call made by the assistant"""

    id: str | None = None
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
    tool_calls: list[ToolCall] | None = None


class ToolMessage(BaseModel):
    """Tool response message in conversation"""

    role: Literal["tool"]
    tool_call_id: str | None = None
    content: str
    name: str


ConversationMessage = Union[UserMessage, AssistantMessage, ToolMessage]

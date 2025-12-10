"""
ReadCode tool - Return the current SDK code for this session.
"""

from pydantic import BaseModel

from app.services.session import SessionService
from app.agent.tools.base import (
    BaseDeclarativeTool,
    BaseToolInvocation,
    ToolResult,
    make_tool_schema,
)


class ReadCodeParams(BaseModel):
    """Parameters for read_code tool"""

    session_id: str


class ReadCodeInvocation(BaseToolInvocation[ReadCodeParams, str]):
    """Invocation for reading SDK code"""

    def get_description(self) -> str:
        return f"Read current SDK code for session {self.params.session_id}"

    async def execute(self) -> ToolResult:
        try:
            code = SessionService.load_code(self.params.session_id)
            return ToolResult(output=code)
        except FileNotFoundError:
            return ToolResult(error=f"Session {self.params.session_id} not found")
        except Exception as exc:
            return ToolResult(error=f"Error reading code: {str(exc)}")


class ReadCodeTool(BaseDeclarativeTool):
    """Tool for reading the current SDK code"""

    def __init__(self) -> None:
        schema = make_tool_schema(
            name="read_code",
            description=(
                "Read the current Python SDK script for this session. "
                "Use this before editing to inspect the full code if needed."
            ),
        )
        super().__init__("read_code", schema)

    async def build(self, params: dict) -> ReadCodeInvocation:
        validated = ReadCodeParams(**params)
        return ReadCodeInvocation(validated)


"""
ReadCode tool - Read current SDK code from session with line numbers
"""

from google.genai.types import FunctionDeclaration, Type
from pydantic import BaseModel

from app.services.session import SessionService
from app.agent.tools.base import BaseDeclarativeTool, BaseToolInvocation, ToolResult


class ReadCodeParams(BaseModel):
    """Parameters for read_code tool"""

    session_id: str
    offset: int | None = None  # Starting line number (1-indexed)
    limit: int | None = None  # Number of lines to read


class ReadCodeInvocation(BaseToolInvocation[ReadCodeParams, str]):
    """Invocation for reading SDK code with line numbers"""

    def get_description(self) -> str:
        desc = f"Read SDK code from session {self.params.session_id}"
        if self.params.offset:
            desc += f" starting at line {self.params.offset}"
        if self.params.limit:
            desc += f" ({self.params.limit} lines)"
        return desc

    async def execute(self) -> ToolResult:
        try:
            code = SessionService.load_code(self.params.session_id)

            # Check if code is empty
            if not code or code.strip() == "":
                return ToolResult(output="The file is empty. Use edit_code with an empty old_string to add initial code.")

            # Split into lines
            lines = code.split('\n')

            # Apply offset and limit
            start_line = (self.params.offset - 1) if self.params.offset else 0
            end_line = start_line + self.params.limit if self.params.limit else len(lines)

            # Clamp to valid ranges
            start_line = max(0, start_line)
            end_line = min(len(lines), end_line)

            # Format with line numbers (cat -n style)
            formatted_lines = []
            for i in range(start_line, end_line):
                line_num = i + 1
                line_content = lines[i]
                formatted_lines.append(f"{line_num:6d}\t{line_content}")

            output = '\n'.join(formatted_lines)

            # Add metadata
            if self.params.offset or self.params.limit:
                output = f"Lines {start_line + 1}-{end_line} of {len(lines)}:\n{output}"
            else:
                output = f"Total {len(lines)} lines:\n{output}"

            return ToolResult(output=output)

        except FileNotFoundError:
            return ToolResult(error=f"Session {self.params.session_id} not found")
        except Exception as e:
            return ToolResult(error=f"Error reading code: {str(e)}")


class ReadCodeTool(BaseDeclarativeTool):
    """Tool for reading current SDK code with line numbers"""

    def __init__(self):
        schema = FunctionDeclaration(
            name="read_code",
            description="Read the current SDK code with line numbers. Supports reading specific line ranges.",
            parameters={
                "type": Type.OBJECT,
                "properties": {
                    "offset": {
                        "type": Type.INTEGER,
                        "description": "Starting line number (1-indexed). Optional - defaults to beginning of file.",
                    },
                    "limit": {
                        "type": Type.INTEGER,
                        "description": "Number of lines to read. Optional - defaults to reading entire file.",
                    },
                },
                "required": [],
            },
        )
        super().__init__("read_code", schema)

    async def build(self, params: dict) -> ReadCodeInvocation:
        validated = ReadCodeParams(**params)
        return ReadCodeInvocation(validated)

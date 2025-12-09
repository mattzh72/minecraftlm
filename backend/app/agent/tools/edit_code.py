"""
EditCode tool - Make precise edits to SDK code using old_string/new_string
"""

from pydantic import BaseModel

from app.services.session import SessionService
from app.agent.tools.base import BaseDeclarativeTool, BaseToolInvocation, ToolResult, make_tool_schema


class EditCodeParams(BaseModel):
    """Parameters for edit_code tool"""

    session_id: str
    old_string: str
    new_string: str


class EditCodeInvocation(BaseToolInvocation[EditCodeParams, str]):
    """Invocation for editing SDK code"""

    def __init__(self, params: EditCodeParams, session_service: SessionService):
        super().__init__(params)
        self._session_service = session_service

    def get_description(self) -> str:
        preview = self.params.old_string[:50]
        if len(self.params.old_string) > 50:
            preview += "..."
        return f"Edit code in session {self.params.session_id}: replacing '{preview}'"

    async def execute(self) -> ToolResult:
        try:
            # Load current code
            code = self._session_service.load_code(self.params.session_id)

            # Check if old_string exists in code
            if self.params.old_string not in code:
                return ToolResult(
                    error=f"Could not find the old_string in the code. "
                    f"Make sure the string matches exactly, including whitespace and indentation. "
                    f"Check the Current Code section in the system prompt."
                )

            # Count occurrences
            occurrences = code.count(self.params.old_string)
            if occurrences > 1:
                return ToolResult(
                    error=f"The old_string appears {occurrences} times in the code. "
                    f"Please provide a longer, unique string that appears only once."
                )

            # Perform replacement
            new_code = code.replace(self.params.old_string, self.params.new_string)

            # Save updated code
            self._session_service.save_code(self.params.session_id, new_code)

            return ToolResult(output="Code edited successfully")

        except FileNotFoundError:
            return ToolResult(error=f"Session {self.params.session_id} not found")
        except Exception as e:
            return ToolResult(error=f"Error editing code: {str(e)}")


class EditCodeTool(BaseDeclarativeTool):
    """Tool for making precise edits to SDK code"""

    def __init__(self, session_service: SessionService):
        self._session_service = session_service
        schema = make_tool_schema(
            name="edit_code",
            description=(
                "Make a precise edit to the SDK code by replacing old_string with new_string. "
                "The old_string must match exactly (including whitespace and indentation). "
                "Reference the Current Code section in the system prompt for line numbers."
            ),
            parameters={
                "old_string": {
                    "type": "string",
                    "description": (
                        "The exact string to replace. Must match exactly including all whitespace. "
                        "Must be unique (appear only once in the file)."
                    ),
                },
                "new_string": {
                    "type": "string",
                    "description": "The new string to replace it with",
                },
            },
            required=["old_string", "new_string"],
        )
        super().__init__("edit_code", schema)

    async def build(self, params: dict) -> EditCodeInvocation:
        validated = EditCodeParams(**params)
        return EditCodeInvocation(validated, self._session_service)

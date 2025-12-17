"""
EditCode tool - Make precise edits to SDK code using old_string/new_string
"""

from pydantic import BaseModel

from app.agent.tools.base import (
    BaseDeclarativeTool,
    BaseToolInvocation,
    ToolResult,
    make_tool_schema,
)
from app.services.session import SessionService
from app.services.validator import CodeValidator


class EditCodeParams(BaseModel):
    """Parameters for edit_code tool"""

    session_id: str
    old_string: str
    new_string: str
    replace_all: bool = False


class EditCodeInvocation(BaseToolInvocation[EditCodeParams, str]):
    """Invocation for editing SDK code"""

    def get_description(self) -> str:
        preview = self.params.old_string[:50]
        if len(self.params.old_string) > 50:
            preview += "..."
        return f"Edit code in session {self.params.session_id}: replacing '{preview}'"

    async def execute(self) -> ToolResult:
        try:
            # Validate old_string is not empty
            if not self.params.old_string:
                return ToolResult(
                    error="old_string cannot be empty. Please provide the exact string to replace."
                )

            # Load current code
            code = await SessionService.load_code(self.params.session_id)

            # Check if old_string exists in code
            if self.params.old_string not in code:
                return ToolResult(
                    error=f"Could not find the old_string in the code. "
                    f"Make sure the string matches exactly, including whitespace and indentation. "
                )

            # Count occurrences
            occurrences = code.count(self.params.old_string)
            if occurrences > 1 and not self.params.replace_all:
                return ToolResult(
                    error=f"The old_string appears {occurrences} times in the code. "
                    f"Please provide a longer, unique string that appears only once, "
                    f"or use replace_all=true to replace all occurrences."
                )

            # Perform replacement
            new_code = code.replace(self.params.old_string, self.params.new_string)

            # Save updated code
            await SessionService.save_code(self.params.session_id, new_code)

            # Auto-compile and validate for immediate feedback
            compilation = await self._compile_and_validate(new_code)

            # Build success message
            if self.params.replace_all and occurrences > 1:
                success_msg = f"Code edited successfully (replaced {occurrences} occurrences)"
            else:
                success_msg = "Code edited successfully"

            return ToolResult(output=success_msg, compilation=compilation)

        except FileNotFoundError:
            return ToolResult(error=f"Session {self.params.session_id} not found")
        except Exception as e:
            return ToolResult(error=f"Error editing code: {str(e)}")

    async def _compile_and_validate(self, code: str) -> dict:
        """
        Compile and validate the code, returning compilation status.
        If valid, saves the structure for immediate UI rendering.
        """
        validation = CodeValidator.validate_code(code)

        if validation.is_valid:
            # Save structure for UI to render immediately
            await SessionService.save_structure(self.params.session_id, validation.structure)

            # Calculate bounding box to help agent track spatial extent
            blocks = validation.structure.get("blocks", [])
            bounding_box = None
            if blocks:
                min_x = min(b["start"][0] for b in blocks)
                min_y = min(b["start"][1] for b in blocks)
                min_z = min(b["start"][2] for b in blocks)
                max_x = max(b["end"][0] for b in blocks)
                max_y = max(b["end"][1] for b in blocks)
                max_z = max(b["end"][2] for b in blocks)
                bounding_box = {
                    "min": [min_x, min_y, min_z],
                    "max": [max_x, max_y, max_z],
                }

            return {
                "status": "success",
                "error": None,
                "structure_updated": True,
                "block_count": len(blocks),
                "bounding_box": bounding_box,
            }
        else:
            error_msg = validation.error
            if validation.error_line:
                error_msg += f" (line {validation.error_line})"
            return {
                "status": "error",
                "error": error_msg,
                "structure_updated": False,
            }


class EditCodeTool(BaseDeclarativeTool):
    """Tool for making precise edits to SDK code"""

    def __init__(self):
        schema = make_tool_schema(
            name="edit_code",
            description=(
                "Make a precise edit to the SDK code by replacing old_string with new_string. "
                "The old_string must match exactly (including whitespace and indentation). "
            ),
            parameters={
                "old_string": {
                    "type": "string",
                    "description": (
                        "The exact string to replace. Must match exactly including all whitespace. "
                        "By default, must be unique (appear only once in the file) unless replace_all is true."
                    ),
                },
                "new_string": {
                    "type": "string",
                    "description": "The new string to replace it with",
                },
                "replace_all": {
                    "type": "boolean",
                    "description": (
                        "If true, replace all occurrences of old_string. "
                        "If false (default), old_string must be unique. "
                        "Use this for renaming variables/functions across the file."
                    ),
                },
            },
            required=["old_string", "new_string"],
        )
        super().__init__("edit_code", schema)

    async def build(self, params: dict) -> EditCodeInvocation:
        validated = EditCodeParams(**params)
        return EditCodeInvocation(validated)

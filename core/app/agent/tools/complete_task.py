"""
CompleteTask tool - Submit final SDK code with automatic validation
"""

from google.genai.types import FunctionDeclaration, Type
from pydantic import BaseModel

from app.services.session import SessionService
from app.services.validator import CodeValidator
from app.agent.tools.base import BaseDeclarativeTool, BaseToolInvocation, ToolResult


class CompleteTaskParams(BaseModel):
    """Parameters for complete_task tool"""

    session_id: str


class CompleteTaskInvocation(BaseToolInvocation[CompleteTaskParams, str]):
    """Invocation for completing the task"""

    def get_description(self) -> str:
        return f"Complete task for session {self.params.session_id}"

    async def execute(self) -> ToolResult:
        try:
            # Load current code
            code = SessionService.load_code(self.params.session_id)

            # Check if code exists
            if not code or code.strip() == "# Generated SDK code will appear here":
                return ToolResult(
                    error="Cannot complete task: No code has been written yet. "
                    "Use edit_code to write the SDK code first."
                )

            # Validate code
            validation_result = CodeValidator.validate_code(code)

            if not validation_result.is_valid:
                error_msg = f"Code validation failed: {validation_result.error}"
                if validation_result.error_line:
                    error_msg += f" (line {validation_result.error_line})"
                error_msg += "\n\nUse read_code to review the code and edit_code to fix the errors."
                return ToolResult(error=error_msg)

            # Code is valid!
            return ToolResult(
                output="Task completed successfully! The SDK code is valid and ready to use."
            )

        except FileNotFoundError:
            return ToolResult(error=f"Session {self.params.session_id} not found")
        except Exception as e:
            return ToolResult(error=f"Error completing task: {str(e)}")


class CompleteTaskTool(BaseDeclarativeTool):
    """Tool for completing the task with automatic validation"""

    def __init__(self):
        schema = FunctionDeclaration(
            name="complete_task",
            description=(
                "Submit the final SDK code and complete the task. "
                "The code will be automatically validated (syntax and execution). "
                "If validation fails, you'll get error details and can continue fixing. "
                "This is the ONLY way to complete your task."
            ),
            parameters={
                "type": Type.OBJECT,
                "properties": {},
                "required": [],
            },
        )
        super().__init__("complete_task", schema)

    async def build(self, params: dict) -> CompleteTaskInvocation:
        validated = CompleteTaskParams(**params)
        return CompleteTaskInvocation(validated)

"""
Code validator for SDK scripts
"""

import ast
from dataclasses import dataclass


@dataclass
class ValidationResult:
    """Result of code validation"""

    is_valid: bool
    error: str | None = None
    error_line: int | None = None


class CodeValidator:
    """Validates SDK code for syntax and execution"""

    @staticmethod
    def validate_code(code: str) -> ValidationResult:
        """
        Validate that code compiles and can execute.

        Args:
            code: Python code to validate

        Returns:
            ValidationResult with validation results
        """
        # Check if it compiles
        try:
            compile(code, '<string>', 'exec')
        except SyntaxError as e:
            return ValidationResult(
                is_valid=False,
                error=f"Syntax error: {e.msg}",
                error_line=e.lineno,
            )
        except Exception as e:
            return ValidationResult(is_valid=False, error=f"Compilation error: {str(e)}")

        # Try to execute (basic check)
        try:
            # Create a minimal execution environment
            exec_globals = {}
            exec(code, exec_globals)
            return ValidationResult(is_valid=True)
        except Exception as e:
            # Get line number if available
            import traceback
            tb = traceback.extract_tb(e.__traceback__)
            error_line = tb[-1].lineno if tb else None

            return ValidationResult(
                is_valid=False,
                error=f"Execution error: {type(e).__name__}: {str(e)}",
                error_line=error_line,
            )

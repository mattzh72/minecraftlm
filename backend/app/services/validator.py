"""
Code validator for SDK scripts
"""

import ast
import json
import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass
class ValidationResult:
    """Result of code validation"""

    is_valid: bool
    error: str | None = None
    error_line: int | None = None
    structure: dict | None = None  # The generated structure if valid
    warnings: list[dict] | None = None
    captured_output: str | None = None


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

        # Try to execute in an isolated subprocess and capture the structure
        try:
            repo_root = Path(__file__).resolve().parents[3]
            backend_root = repo_root / "backend"

            # Write code to a temp file so tracebacks have stable filenames/line numbers.
            import tempfile

            with tempfile.TemporaryDirectory(prefix="sdk_run_") as tmp_dir:
                code_path = Path(tmp_dir) / "code.py"
                code_path.write_text(code)

                env = dict(os.environ)
                env["PYTHONPATH"] = str(backend_root)

                timeout_s = float(env.get("SDK_RUNNER_TIMEOUT_S", "60"))
                proc = subprocess.run(
                    [sys.executable, "-m", "app.services.code_runner", str(code_path)],
                    cwd=str(repo_root),
                    env=env,
                    capture_output=True,
                    text=True,
                    timeout=timeout_s,
                )

                # Runner prints exactly one JSON object to stdout.
                try:
                    payload = json.loads(proc.stdout.strip() or "{}")
                except Exception:
                    return ValidationResult(
                        is_valid=False,
                        error=f"Execution error: Failed to parse runner output. stderr: {proc.stderr.strip()}",
                    )

                if payload.get("ok"):
                    return ValidationResult(
                        is_valid=True,
                        structure=payload.get("structure"),
                        warnings=payload.get("warnings"),
                        captured_output=payload.get("captured_output"),
                    )

                return ValidationResult(
                    is_valid=False,
                    error=f"Execution error: {payload.get('error')}",
                    error_line=payload.get("error_line"),
                    warnings=payload.get("warnings"),
                    captured_output=payload.get("captured_output"),
                )
        except subprocess.TimeoutExpired as e:
            return ValidationResult(
                is_valid=False,
                error=f"Execution error: Timeout after {e.timeout} seconds",
            )
        except Exception as e:
            return ValidationResult(
                is_valid=False,
                error=f"Execution error: {type(e).__name__}: {str(e)}",
            )

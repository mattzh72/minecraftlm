"""
Execute an SDK script in an isolated Python process and emit a single JSON payload.

This is used by CodeValidator to avoid running user-provided code in the FastAPI
process (which can crash, hang, or spam stdout/stderr).
"""

from __future__ import annotations

import io
import json
import os
import sys
import traceback
import warnings
from contextlib import redirect_stderr, redirect_stdout
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class RunnerResult:
    ok: bool
    structure: Optional[dict] = None
    error: Optional[str] = None
    error_line: Optional[int] = None
    warnings: List[dict] = None
    captured_output: str = ""


def _extract_error_line(tb: traceback.TracebackException, source_path: Path) -> Optional[int]:
    target = str(source_path)
    for frame in reversed(list(tb.stack)):
        if frame.filename == target:
            return frame.lineno
    return tb.stack[-1].lineno if tb.stack else None


def _set_resource_limits() -> None:
    timeout_s = float(os.environ.get("SDK_RUNNER_TIMEOUT_S", "60"))
    max_mem_mb = int(os.environ.get("SDK_RUNNER_MAX_MEM_MB", "4096"))

    try:
        import resource

        # CPU time limit
        cpu_limit = max(1, int(timeout_s))
        resource.setrlimit(resource.RLIMIT_CPU, (cpu_limit, cpu_limit))

        # Address space / virtual memory limit (best-effort)
        max_bytes = max_mem_mb * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (max_bytes, max_bytes))
    except Exception:
        # Best-effort: if resource isn't available (or limits unsupported), continue.
        return


def run_script(source_path: Path) -> RunnerResult:
    _set_resource_limits()

    output_buffer = io.StringIO()
    warning_payloads: List[dict] = []

    try:
        source = source_path.read_text()
    except Exception as exc:
        return RunnerResult(ok=False, error=f"Failed to read code: {exc}", warnings=[], captured_output="")

    exec_globals: Dict[str, Any] = {}

    try:
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            with redirect_stdout(output_buffer), redirect_stderr(output_buffer):
                compiled = compile(source, str(source_path), "exec")
                exec(compiled, exec_globals)

        for item in caught:
            warning_payloads.append(
                {
                    "category": getattr(item.category, "__name__", str(item.category)),
                    "message": str(item.message),
                    "filename": str(item.filename),
                    "lineno": int(item.lineno) if item.lineno is not None else None,
                }
            )

        structure = exec_globals.get("structure")
        if structure is None:
            return RunnerResult(
                ok=False,
                error="Code must define a 'structure' variable at module level",
                warnings=warning_payloads,
                captured_output=_truncate(output_buffer.getvalue()),
            )
        if not isinstance(structure, dict):
            return RunnerResult(
                ok=False,
                error=f"'structure' must be a dict, got {type(structure).__name__}",
                warnings=warning_payloads,
                captured_output=_truncate(output_buffer.getvalue()),
            )

        # Ensure the structure is JSON-serializable.
        try:
            json.dumps(structure)
        except Exception as exc:
            return RunnerResult(
                ok=False,
                error=f"'structure' is not JSON-serializable: {type(exc).__name__}: {exc}",
                warnings=warning_payloads,
                captured_output=_truncate(output_buffer.getvalue()),
            )

        return RunnerResult(
            ok=True,
            structure=structure,
            warnings=warning_payloads,
            captured_output=_truncate(output_buffer.getvalue()),
        )
    except BaseException as exc:
        tb = traceback.TracebackException.from_exception(exc)
        return RunnerResult(
            ok=False,
            error=f"{type(exc).__name__}: {exc}",
            error_line=_extract_error_line(tb, source_path),
            warnings=warning_payloads,
            captured_output=_truncate(output_buffer.getvalue()),
        )


def _truncate(value: str, limit: int = 20_000) -> str:
    if len(value) <= limit:
        return value
    return value[:limit] + "\n... [truncated] ..."


def main(argv: List[str]) -> int:
    if len(argv) != 2:
        print(json.dumps({"ok": False, "error": "Usage: python -m app.services.code_runner <code.py>"}))
        return 2

    source_path = Path(argv[1]).resolve()
    result = run_script(source_path)

    payload = {
        "ok": result.ok,
        "structure": result.structure,
        "error": result.error,
        "error_line": result.error_line,
        "warnings": result.warnings or [],
        "captured_output": result.captured_output,
    }
    print(json.dumps(payload))
    return 0 if result.ok else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

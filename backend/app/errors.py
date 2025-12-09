"""
Centralized error handling for FastAPI application.
Follows the pattern from sake codebase.
"""

import functools
import logging
from typing import Callable, cast

from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class ErrorResponse(BaseModel):
    """Standard error response format."""

    code: int = Field(description="HTTP status code")
    messages: list[str] = Field(description="Error messages")


def _log_500_errors(f: Callable[[Request, Exception], Response]):
    """Decorator to log 500 errors with full traceback."""

    @functools.wraps(f)
    def wrapper(request: Request, exc: Exception) -> Response:
        response = f(request, exc)

        if response.status_code >= 500:
            logger.exception("An error occurred handling request", exc_info=exc)

        return response

    return wrapper


def _format_validation_error(error: dict) -> str:
    """Format a single validation error for display."""
    msg = error.get("msg", "Validation error")
    type_ = error.get("type", "unknown")
    loc = ".".join(str(e) for e in error.get("loc", []))

    return f"{msg} (type={type_} at {loc})"


@_log_500_errors
def _validation_exception_handler(_request: Request, exc: Exception) -> Response:
    """Handle Pydantic validation errors."""
    exc = cast(RequestValidationError, exc)
    messages = [_format_validation_error(err) for err in exc.errors()]

    return JSONResponse(
        ErrorResponse(
            code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            messages=messages,
        ).model_dump(),
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
    )


@_log_500_errors
def _http_exception_handler(_request: Request, exc: Exception) -> Response:
    """Handle HTTP exceptions."""
    exc_act = cast(HTTPException, exc)

    return JSONResponse(
        ErrorResponse(
            code=exc_act.status_code,
            messages=[exc_act.detail] if isinstance(exc_act.detail, str) else exc_act.detail,
        ).model_dump(),
        status_code=exc_act.status_code,
    )


@_log_500_errors
def _catchall_exception_handler(_request: Request, _exc: Exception) -> Response:
    """Handle all other unhandled exceptions."""
    return JSONResponse(
        ErrorResponse(
            code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            messages=["An unexpected error occurred"],
        ).model_dump(),
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


def register_exception_handlers(app: FastAPI):
    """Register all exception handlers to the app."""
    app.add_exception_handler(RequestValidationError, _validation_exception_handler)
    app.add_exception_handler(HTTPException, _http_exception_handler)
    app.add_exception_handler(Exception, _catchall_exception_handler)

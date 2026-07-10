from __future__ import annotations

from uuid import uuid4

from fastapi import Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response


async def uok_request_validation_error_handler(request: Request, exc: RequestValidationError) -> Response:
    if not _uses_command_error_contract(request.url.path):
        return await request_validation_exception_handler(request, exc)
    errors = exc.errors()
    first = errors[0] if errors else {}
    field = _validation_field(first.get("loc"))
    message = str(first.get("msg") or "The request does not match the documented contract.")
    object_ids = [
        str(value)
        for name, value in request.path_params.items()
        if (name == "id" or name.endswith("_id")) and value not in (None, "")
    ]
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "command_request_invalid" if request.url.path == "/api/commands" else "planning_request_invalid",
                "message": message,
                "field": field,
                "object_ids": object_ids,
                "repair": "Correct the identified request field against the generated API contract, then retry the same intent.",
                "current_revision": None,
                "correlation_id": str(uuid4()),
            }
        },
    )


def _uses_command_error_contract(path: str) -> bool:
    return path == "/api/commands" or path.startswith("/api/planning/")


def _validation_field(location: object) -> str | None:
    if not isinstance(location, tuple | list):
        return None
    fields = [str(item) for item in location if str(item) not in {"body", "header", "path", "query"}]
    return ".".join(fields) if fields else None


__all__ = ["uok_request_validation_error_handler"]

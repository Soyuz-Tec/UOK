from __future__ import annotations

from typing import Any

from fastapi import HTTPException, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from uok.host.commands import execute_command
from uok.kernel.command_contracts import (
    COMMAND_ETAG_RESULT_KEY,
    CommandDomainError,
    CommandPermissionError,
    CommandPreconditionError,
    IdempotencyConflictError,
)
from uok.kernel.module_runtime import ensure_module_operational
from uok.kernel.security import Actor, require_permission


def require_planning_read(db: Session, actor: Actor) -> None:
    try:
        require_permission(actor, "planning.read")
        ensure_module_operational(db, actor.organization_id, "planning.core")
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


def run_planning_command(
    db: Session,
    actor: Actor,
    command_type: str,
    payload: dict[str, Any],
    idempotency_key: str,
    response: Response,
    if_match: str | None = None,
) -> dict[str, Any] | JSONResponse:
    try:
        stored = execute_command(db, actor, command_type, payload, idempotency_key, if_match)["result"]
        result = dict(stored)
        etag = result.pop(COMMAND_ETAG_RESULT_KEY, None)
        if etag:
            response.headers["ETag"] = str(etag)
            response.headers["Cache-Control"] = "private, no-store"
            response.headers["Vary"] = "Authorization"
        return result
    except CommandPermissionError as exc:
        return JSONResponse(status_code=exc.status_code, content=exc.response_body())
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except IdempotencyConflictError as exc:
        return JSONResponse(status_code=exc.status_code, content=exc.response_body())
    except CommandPreconditionError as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.response_body(),
            headers={"ETag": exc.current_etag, "Cache-Control": "private, no-store", "Vary": "Authorization"},
        )
    except CommandDomainError as exc:
        return JSONResponse(status_code=exc.status_code, content=exc.response_body())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


__all__ = ["require_planning_read", "run_planning_command"]

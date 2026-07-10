from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ..api.schemas import CommandDomainErrorResponse, CommandPreconditionResponse, CommandRequest
from ..commands import (
    COMMAND_ETAG_RESULT_KEY,
    CommandDomainError,
    CommandPermissionError,
    CommandPreconditionError,
    IdempotencyConflictError,
    clean_command_text,
    execute_command,
)
from ..db import get_db
from ..security import Actor, current_actor

router = APIRouter(tags=["commands"])
IDEMPOTENCY_CONFLICT_RESPONSE = {
    409: {
        "model": CommandDomainErrorResponse,
        "description": "Idempotency key conflicts with another command request.",
    },
    403: {"model": CommandDomainErrorResponse, "description": "The actor lacks the command capability."},
    400: {"model": CommandPreconditionResponse, "description": "The command precondition is malformed or inconsistent."},
    412: {"model": CommandPreconditionResponse, "description": "The command precondition is stale."},
    428: {"model": CommandPreconditionResponse, "description": "The command requires a current precondition."},
    200: {
        "description": "Command accepted or idempotently replayed.",
        "headers": {
            "ETag": {
                "description": "Strong Planning schedule validator when the command mutates Planning.",
                "schema": {"type": "string"},
            }
        },
    },
}


@router.post("/api/commands", responses=IDEMPOTENCY_CONFLICT_RESPONSE, response_model=None)
def command(
    req: CommandRequest,
    response: Response,
    if_match: str | None = Header(default=None, alias="If-Match"),
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, object] | JSONResponse:
    command_type = clean_command_text(req.command_type)
    key = clean_command_text(req.idempotency_key)
    try:
        stored = execute_command(db, actor, command_type, req.payload, key, if_match)
        result = dict(stored)
        command_result = dict(result["result"])
        etag = command_result.pop(COMMAND_ETAG_RESULT_KEY, None)
        result["result"] = command_result
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

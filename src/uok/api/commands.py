from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..api.schemas import CommandRequest, IdempotencyConflictResponse
from ..commands import (
    IdempotencyConflictError,
    clean_command_text,
    execute_command,
)
from ..db import get_db
from ..security import Actor, current_actor

router = APIRouter(tags=["commands"])
IDEMPOTENCY_CONFLICT_RESPONSE = {
    409: {
        "model": IdempotencyConflictResponse,
        "description": "Idempotency key conflicts with another command request.",
    }
}


@router.post("/api/commands", responses=IDEMPOTENCY_CONFLICT_RESPONSE)
def command(req: CommandRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, object]:
    command_type = clean_command_text(req.command_type)
    key = clean_command_text(req.idempotency_key)
    try:
        return execute_command(db, actor, command_type, req.payload, key)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except IdempotencyConflictError as exc:
        raise HTTPException(status_code=409, detail={"error": str(exc)}) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc

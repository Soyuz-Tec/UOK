from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..api.schemas import CommandRequest
from ..commands import execute_command
from ..db import get_db
from ..security import Actor, current_actor

router = APIRouter(tags=["commands"])


@router.post("/api/commands")
def command(req: CommandRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, object]:
    try:
        return execute_command(db, actor, req.command_type, req.payload, req.idempotency_key)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc

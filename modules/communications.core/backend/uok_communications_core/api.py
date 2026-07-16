from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from uok.host.database import get_db
from uok.kernel.module_runtime import ensure_module_operational
from uok.security import Actor, current_actor, require_permission

from .service import list_threads, serialize_thread, thread_or_error

router = APIRouter(prefix="/api/communications", tags=["communications"])


def require_communications_read(db: Session, actor: Actor) -> None:
    try:
        require_permission(actor, "communications.read")
        ensure_module_operational(db, actor.organization_id, "communications.core")
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


@router.get("/threads")
def threads(actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> list[dict[str, object]]:
    require_communications_read(db, actor)
    return list_threads(db, actor)


@router.get("/threads/{thread_id}")
def thread_detail(thread_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, object]:
    require_communications_read(db, actor)
    try:
        return serialize_thread(thread_or_error(db, actor, thread_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail={"error": str(exc)}) from exc

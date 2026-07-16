from __future__ import annotations

from typing import Any, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from uok.host.commands import execute_command
from uok.host.database import get_db
from uok.host.security import current_actor
from uok.kernel.command_contracts import (
    COMMAND_ETAG_RESULT_KEY,
    CommandDomainError,
    CommandPermissionError,
    CommandPreconditionError,
)
from uok.kernel.module_runtime import ensure_module_operational
from uok.kernel.security import Actor, require_permission

from .policy import capability_read_model
from .service import list_threads, serialize_thread, thread_or_error

router = APIRouter(prefix="/api/communications", tags=["communications"])
PRIVATE_RESPONSE_HEADERS = {"Cache-Control": "private, no-store", "Vary": "Authorization"}


def apply_private_headers(response: Response) -> None:
    for name, value in PRIVATE_RESPONSE_HEADERS.items():
        response.headers[name] = value


def require_communications_read(db: Session, actor: Actor) -> None:
    try:
        require_permission(actor, "communications.read")
        ensure_module_operational(db, actor.organization_id, "communications.core")
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


def run_communications_command(
    db: Session,
    actor: Actor,
    command_type: str,
    thread_id: str,
    response: Response,
    if_match: str | None,
) -> dict[str, Any] | JSONResponse:
    try:
        stored = execute_command(
            db,
            actor,
            command_type,
            {"thread_id": thread_id},
            f"{command_type}:{uuid4()}",
            if_match,
        )["result"]
        result = dict(stored)
        etag = result.pop(COMMAND_ETAG_RESULT_KEY, None)
        apply_private_headers(response)
        if etag:
            response.headers["ETag"] = str(etag)
        return result
    except CommandPermissionError as exc:
        return JSONResponse(status_code=exc.status_code, content=exc.response_body(), headers=PRIVATE_RESPONSE_HEADERS)
    except CommandDomainError as exc:
        return JSONResponse(status_code=exc.status_code, content=exc.response_body(), headers=PRIVATE_RESPONSE_HEADERS)
    except CommandPreconditionError as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.response_body(),
            headers={"ETag": exc.current_etag, **PRIVATE_RESPONSE_HEADERS},
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


@router.get("/capabilities")
def communication_capabilities(
    response: Response,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    require_communications_read(db, actor)
    apply_private_headers(response)
    return capability_read_model(actor)


@router.get("/threads")
def threads(
    response: Response,
    lifecycle: Literal["active", "archived", "all"] = Query(default="active"),
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    require_communications_read(db, actor)
    apply_private_headers(response)
    return list_threads(db, actor, lifecycle)


@router.get("/threads/{thread_id}")
def thread_detail(
    thread_id: str,
    response: Response,
    include_archived: bool = Query(default=False),
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    require_communications_read(db, actor)
    try:
        result = serialize_thread(thread_or_error(db, actor, thread_id, include_archived=include_archived))
        response.headers["ETag"] = str(result["etag"])
        apply_private_headers(response)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=404, detail={"error": str(exc)}) from exc


@router.delete("/threads/{thread_id}", response_model=None)
def archive_thread(
    thread_id: str,
    response: Response,
    if_match: str | None = Header(default=None, alias="If-Match"),
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any] | JSONResponse:
    return run_communications_command(db, actor, "ArchiveCommunicationThread", thread_id, response, if_match)


@router.post("/threads/{thread_id}/restore", response_model=None)
def restore_thread(
    thread_id: str,
    response: Response,
    if_match: str | None = Header(default=None, alias="If-Match"),
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any] | JSONResponse:
    return run_communications_command(db, actor, "RestoreCommunicationThread", thread_id, response, if_match)

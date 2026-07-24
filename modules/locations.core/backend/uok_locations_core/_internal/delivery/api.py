from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from uok.host.database import get_db
from uok.host.security import current_actor
from uok.kernel.module_runtime import ensure_module_operational
from uok.kernel.security import Actor, require_permission

from .schemas import LocationDefinitionResponse, LocationNameHistoryResponse
from .service import get_location_definition, list_location_definitions, list_location_name_history, location_definition_response

router = APIRouter(prefix="/api/locations", tags=["locations"])


@router.get("/definitions", response_model=list[LocationDefinitionResponse])
def definitions(
    include_archived: bool = False,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    _require_read_access(db, actor)
    return list_location_definitions(db, actor, include_archived)


@router.get("/definitions/{location_definition_id}", response_model=LocationDefinitionResponse)
def definition(
    location_definition_id: str,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    _require_read_access(db, actor)
    try:
        return location_definition_response(get_location_definition(db, actor, location_definition_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail={"error": str(exc)}) from exc


@router.get(
    "/definitions/{location_definition_id}/name-history",
    response_model=list[LocationNameHistoryResponse],
)
def name_history(
    location_definition_id: str,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    _require_read_access(db, actor)
    try:
        return list_location_name_history(db, actor, location_definition_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail={"error": str(exc)}) from exc


def _require_read_access(db: Session, actor: Actor) -> None:
    try:
        require_permission(actor, "locations.read")
        ensure_module_operational(db, actor.organization_id, "locations.core")
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc

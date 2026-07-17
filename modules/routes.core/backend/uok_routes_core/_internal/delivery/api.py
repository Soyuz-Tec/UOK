from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from uok.host.database import get_db
from uok.host.security import current_actor
from uok.kernel.module_runtime import ensure_module_operational
from uok.kernel.security import Actor, require_permission

from .location_gateway import active_location_options
from .read_service import (
    get_route_definition,
    list_route_definitions,
    list_route_name_history,
    route_definition_response,
)
from .schemas import LocationReferenceResponse, RouteDefinitionResponse, RouteNameHistoryResponse

router = APIRouter(prefix="/api/routes", tags=["routes"])


@router.get("/location-options", response_model=list[LocationReferenceResponse])
def location_options(
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    _require_read_access(db, actor)
    try:
        return active_location_options(db, actor)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


@router.get("/definitions", response_model=list[RouteDefinitionResponse])
def definitions(
    include_archived: bool = False,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    _require_read_access(db, actor)
    return list_route_definitions(db, actor, include_archived)


@router.get("/definitions/{route_definition_id}", response_model=RouteDefinitionResponse)
def definition(
    route_definition_id: str,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    _require_read_access(db, actor)
    try:
        row = get_route_definition(db, actor, route_definition_id)
        return route_definition_response(db, actor, row)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail={"error": str(exc)}) from exc


@router.get(
    "/definitions/{route_definition_id}/name-history",
    response_model=list[RouteNameHistoryResponse],
)
def name_history(
    route_definition_id: str,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    _require_read_access(db, actor)
    try:
        return list_route_name_history(db, actor, route_definition_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail={"error": str(exc)}) from exc


def _require_read_access(db: Session, actor: Actor) -> None:
    try:
        require_permission(actor, "routes.read")
        ensure_module_operational(db, actor.organization_id, "routes.core")
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc

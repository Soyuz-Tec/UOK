from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from uok.host.database import get_db
from uok.host.security import current_actor
from uok.kernel.module_runtime import ensure_module_operational
from uok.kernel.security import Actor, require_permission

from .location_gateway import active_location_options
from .party_gateway import party_resolution_response, resolve_party
from .read_service import get_shipment, list_shipments, list_status_history, shipment_response
from .route_gateway import active_route_options
from .schemas import (
    LocationReferenceResponse,
    PartyReferenceResponse,
    RoutePathReferenceResponse,
    ShipmentResponse,
    ShipmentStatusHistoryResponse,
)

router = APIRouter(prefix="/api/shipments", tags=["shipments"])


@router.get("/records", response_model=list[ShipmentResponse])
def records(
    status: str | None = None,
    search: str | None = None,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    _require_read_access(db, actor)
    return list_shipments(db, actor, status, search)


@router.get("/records/{shipment_id}", response_model=ShipmentResponse)
def record(
    shipment_id: str,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    _require_read_access(db, actor)
    try:
        return shipment_response(db, actor, get_shipment(db, actor, shipment_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail={"error": str(exc)}) from exc


@router.get(
    "/records/{shipment_id}/status-history",
    response_model=list[ShipmentStatusHistoryResponse],
)
def status_history(
    shipment_id: str,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    _require_read_access(db, actor)
    try:
        return list_status_history(db, actor, shipment_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail={"error": str(exc)}) from exc


@router.get("/party-references/{party_id}", response_model=PartyReferenceResponse)
def party_reference(
    party_id: str,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    _require_read_access(db, actor)
    return party_resolution_response(resolve_party(db, actor, party_id))


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


@router.get("/route-options", response_model=list[RoutePathReferenceResponse])
def route_options(
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    _require_read_access(db, actor)
    try:
        return active_route_options(db, actor)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


def _require_read_access(db: Session, actor: Actor) -> None:
    try:
        require_permission(actor, "shipments.read")
        ensure_module_operational(db, actor.organization_id, "shipments.core")
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


__all__ = ["router"]

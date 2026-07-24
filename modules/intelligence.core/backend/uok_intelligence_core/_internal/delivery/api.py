from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from uok.host.database import get_db
from uok.host.security import current_actor
from uok.kernel.module_runtime import ensure_module_operational
from uok.kernel.security import Actor, require_permission

from .readiness import derive_shipment_readiness
from .schemas import ShipmentReadinessListResponse
from .shipment_gateway import load_shipment_readiness_facts

router = APIRouter(prefix="/api/intelligence", tags=["intelligence"])


@router.get(
    "/shipment-readiness",
    response_model=ShipmentReadinessListResponse,
)
def shipment_readiness(
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> ShipmentReadinessListResponse:
    _require_read_access(db, actor)
    try:
        facts = load_shipment_readiness_facts(db, actor)
    except PermissionError as exc:
        raise HTTPException(
            status_code=403,
            detail="Shipment readiness source is not available to this actor.",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"error": "Shipment readiness source is unavailable."},
        ) from exc
    return ShipmentReadinessListResponse(
        source_status="ready",
        source_summary="Shipment readiness source is available.",
        items=tuple(derive_shipment_readiness(value) for value in facts),
    )


def _require_read_access(db: Session, actor: Actor) -> None:
    try:
        require_permission(actor, "intelligence.read")
        ensure_module_operational(
            db,
            actor.organization_id,
            "intelligence.core",
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=403,
            detail=f"Permission denied: {exc}",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"error": str(exc)},
        ) from exc


__all__ = ["router"]

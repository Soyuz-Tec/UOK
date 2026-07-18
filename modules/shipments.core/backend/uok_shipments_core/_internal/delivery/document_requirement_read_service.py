from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok.kernel.security import Actor

from uok_shipments_core._internal.persistence.models import (
    ShipmentDocumentRequirement,
    ShipmentDocumentRequirementHistory,
)

from .compliance_gateway import (
    document_type_resolution_response,
    resolve_document_types,
)
from .document_requirement_schemas import (
    ShipmentDocumentRequirementHistoryResponse,
    ShipmentDocumentRequirementListResponse,
    ShipmentDocumentRequirementResponse,
    ShipmentDocumentRequirementSummaryResponse,
)
from .read_service import get_shipment


def list_document_requirements(
    db: Session,
    actor: Actor,
    shipment_id: str,
) -> dict[str, Any]:
    get_shipment(db, actor, shipment_id)
    rows = db.scalars(select(ShipmentDocumentRequirement).where(
        ShipmentDocumentRequirement.organization_id == actor.organization_id,
        ShipmentDocumentRequirement.shipment_id == shipment_id,
    ).order_by(
        ShipmentDocumentRequirement.requirement_level,
        ShipmentDocumentRequirement.created_at,
        ShipmentDocumentRequirement.id,
    )).all()
    items = _requirement_responses(db, actor, rows)
    response = ShipmentDocumentRequirementListResponse(
        items=tuple(items),
        summary=_requirement_summary(rows),
    )
    return response.model_dump(mode="json")


def list_document_requirement_history(
    db: Session,
    actor: Actor,
    shipment_id: str,
    requirement_id: str,
) -> list[dict[str, Any]]:
    get_shipment(db, actor, shipment_id)
    rows = db.scalars(select(ShipmentDocumentRequirementHistory).where(
        ShipmentDocumentRequirementHistory.organization_id == actor.organization_id,
        ShipmentDocumentRequirementHistory.shipment_id == shipment_id,
        ShipmentDocumentRequirementHistory.requirement_id == requirement_id,
    ).order_by(
        ShipmentDocumentRequirementHistory.changed_at.desc(),
        ShipmentDocumentRequirementHistory.id.desc(),
    )).all()
    if not rows:
        raise ValueError("shipment document requirement not found")
    resolutions = resolve_document_types(
        db,
        actor,
        (row.compliance_document_type_id for row in rows),
    )
    return [
        _history_response(row, document_type_resolution_response(resolution))
        for row, resolution in zip(rows, resolutions, strict=True)
    ]


def requirement_response(
    db: Session,
    actor: Actor,
    row: ShipmentDocumentRequirement,
    correlation_id: str | None = None,
) -> dict[str, Any]:
    result = _requirement_responses(db, actor, [row])[0]
    if correlation_id is not None:
        result["correlation_id"] = correlation_id
    return result


def _requirement_responses(
    db: Session,
    actor: Actor,
    rows: list[ShipmentDocumentRequirement],
) -> list[dict[str, Any]]:
    resolutions = resolve_document_types(
        db,
        actor,
        (row.compliance_document_type_id for row in rows),
    )
    return [
        _requirement_response(row, document_type_resolution_response(resolution))
        for row, resolution in zip(rows, resolutions, strict=True)
    ]


def _requirement_response(
    row: ShipmentDocumentRequirement,
    document_type: dict[str, object],
) -> dict[str, Any]:
    response = ShipmentDocumentRequirementResponse(
        id=row.id,
        shipment_id=row.shipment_id,
        compliance_document_type_id=document_type["compliance_document_type_id"],
        requirement_level=row.requirement_level,
        status=row.status,
        notes=row.notes,
        version=row.version,
        created_by_user_id=row.created_by_user_id,
        updated_by_user_id=row.updated_by_user_id,
        created_at=row.created_at,
        updated_at=row.updated_at,
        document_type=document_type,
    )
    return response.model_dump(mode="json")


def _history_response(
    row: ShipmentDocumentRequirementHistory,
    document_type: dict[str, object],
) -> dict[str, Any]:
    response = ShipmentDocumentRequirementHistoryResponse(
        id=row.id,
        shipment_id=row.shipment_id,
        requirement_id=row.requirement_id,
        compliance_document_type_id=document_type["compliance_document_type_id"],
        action=row.action,
        requirement_level=row.requirement_level,
        status=row.status,
        notes=row.notes,
        version=row.version,
        reason=row.reason,
        changed_by_user_id=row.changed_by_user_id,
        changed_at=row.changed_at,
        document_type=document_type,
    )
    return response.model_dump(mode="json")


def _requirement_summary(
    rows: list[ShipmentDocumentRequirement],
) -> ShipmentDocumentRequirementSummaryResponse:
    required = [row for row in rows if row.requirement_level == "required"]
    counts = {
        status: sum(row.status == status for row in required)
        for status in ("missing", "received", "waived", "not_applicable")
    }
    return ShipmentDocumentRequirementSummaryResponse(
        required_total=len(required),
        required_satisfied=counts["received"] + counts["waived"] + counts["not_applicable"],
        required_missing=counts["missing"],
        required_received=counts["received"],
        required_waived=counts["waived"],
        required_not_applicable=counts["not_applicable"],
        optional_total=sum(row.requirement_level == "optional" for row in rows),
    )


__all__ = [
    "list_document_requirement_history",
    "list_document_requirements",
    "requirement_response",
]

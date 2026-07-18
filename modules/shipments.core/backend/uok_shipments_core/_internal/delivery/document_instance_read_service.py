from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok.kernel.security import Actor

from uok_shipments_core._internal.persistence.models import (
    ShipmentDocumentInstance,
    ShipmentDocumentInstanceHistory,
    ShipmentDocumentRequirement,
)

from .compliance_gateway import (
    document_type_resolution_response,
    resolve_document_types,
)
from .document_instance_schemas import (
    ShipmentDocumentInstanceHistoryResponse,
    ShipmentDocumentInstanceResponse,
)
from .read_service import get_shipment


def list_document_instances(
    db: Session,
    actor: Actor,
    shipment_id: str,
) -> list[dict[str, Any]]:
    get_shipment(db, actor, shipment_id)
    rows = db.scalars(select(ShipmentDocumentInstance).where(
        ShipmentDocumentInstance.organization_id == actor.organization_id,
        ShipmentDocumentInstance.shipment_id == shipment_id,
    ).order_by(
        ShipmentDocumentInstance.updated_at.desc(),
        ShipmentDocumentInstance.id.desc(),
    )).all()
    return _instance_responses(db, actor, rows)


def get_document_instance(
    db: Session,
    actor: Actor,
    shipment_id: str,
    instance_id: str,
) -> dict[str, Any]:
    get_shipment(db, actor, shipment_id)
    row = db.scalar(select(ShipmentDocumentInstance).where(
        ShipmentDocumentInstance.id == instance_id,
        ShipmentDocumentInstance.organization_id == actor.organization_id,
        ShipmentDocumentInstance.shipment_id == shipment_id,
    ))
    if row is None:
        raise ValueError("shipment document instance not found")
    return document_instance_response(db, actor, row)


def list_document_instance_history(
    db: Session,
    actor: Actor,
    shipment_id: str,
    instance_id: str,
) -> list[dict[str, Any]]:
    get_shipment(db, actor, shipment_id)
    rows = db.scalars(select(ShipmentDocumentInstanceHistory).where(
        ShipmentDocumentInstanceHistory.organization_id == actor.organization_id,
        ShipmentDocumentInstanceHistory.shipment_id == shipment_id,
        ShipmentDocumentInstanceHistory.instance_id == instance_id,
    ).order_by(
        ShipmentDocumentInstanceHistory.changed_at.desc(),
        ShipmentDocumentInstanceHistory.id.desc(),
    )).all()
    if not rows:
        raise ValueError("shipment document instance not found")
    resolutions = resolve_document_types(
        db,
        actor,
        (row.compliance_document_type_id for row in rows),
    )
    return [
        _history_response(row, document_type_resolution_response(resolution))
        for row, resolution in zip(rows, resolutions, strict=True)
    ]


def document_instance_response(
    db: Session,
    actor: Actor,
    row: ShipmentDocumentInstance,
    correlation_id: str | None = None,
) -> dict[str, Any]:
    result = _instance_responses(db, actor, [row])[0]
    if correlation_id is not None:
        result["correlation_id"] = correlation_id
    return result


def _instance_responses(
    db: Session,
    actor: Actor,
    rows: list[ShipmentDocumentInstance],
) -> list[dict[str, Any]]:
    if not rows:
        return []
    resolutions = resolve_document_types(
        db,
        actor,
        (row.compliance_document_type_id for row in rows),
    )
    requirements = _requirements_by_id(db, actor, rows)
    return [
        _instance_response(
            row,
            document_type_resolution_response(resolution),
            requirements.get(row.requirement_id),
        )
        for row, resolution in zip(rows, resolutions, strict=True)
    ]


def _requirements_by_id(
    db: Session,
    actor: Actor,
    rows: list[ShipmentDocumentInstance],
) -> dict[str, ShipmentDocumentRequirement]:
    requirement_ids = tuple(dict.fromkeys(
        row.requirement_id
        for row in rows
        if row.requirement_id is not None
    ))
    if not requirement_ids:
        return {}
    requirement_rows = db.scalars(select(ShipmentDocumentRequirement).where(
        ShipmentDocumentRequirement.organization_id == actor.organization_id,
        ShipmentDocumentRequirement.shipment_id == rows[0].shipment_id,
        ShipmentDocumentRequirement.id.in_(requirement_ids),
    )).all()
    return {row.id: row for row in requirement_rows}


def _instance_response(
    row: ShipmentDocumentInstance,
    document_type: dict[str, object],
    requirement: ShipmentDocumentRequirement | None,
) -> dict[str, Any]:
    response = ShipmentDocumentInstanceResponse(
        id=row.id,
        shipment_id=row.shipment_id,
        compliance_document_type_id=document_type["compliance_document_type_id"],
        requirement_id=row.requirement_id,
        document_number=row.document_number,
        issuing_party_name=row.issuing_party_name,
        issued_on=row.issued_on,
        expires_on=row.expires_on,
        status=row.status,
        notes=row.notes,
        version=row.version,
        created_by_user_id=row.created_by_user_id,
        updated_by_user_id=row.updated_by_user_id,
        created_at=row.created_at,
        updated_at=row.updated_at,
        document_type=document_type,
        requirement=(
            None
            if requirement is None
            else {
                "id": requirement.id,
                "requirement_level": requirement.requirement_level,
                "status": requirement.status,
                "version": requirement.version,
            }
        ),
    )
    return response.model_dump(mode="json")


def _history_response(
    row: ShipmentDocumentInstanceHistory,
    document_type: dict[str, object],
) -> dict[str, Any]:
    response = ShipmentDocumentInstanceHistoryResponse(
        id=row.id,
        shipment_id=row.shipment_id,
        instance_id=row.instance_id,
        compliance_document_type_id=document_type["compliance_document_type_id"],
        requirement_id=row.requirement_id,
        document_number=row.document_number,
        issuing_party_name=row.issuing_party_name,
        issued_on=row.issued_on,
        expires_on=row.expires_on,
        status=row.status,
        notes=row.notes,
        action=row.action,
        version=row.version,
        reason=row.reason,
        changed_by_user_id=row.changed_by_user_id,
        changed_at=row.changed_at,
        document_type=document_type,
    )
    return response.model_dump(mode="json")


__all__ = [
    "document_instance_response",
    "get_document_instance",
    "list_document_instance_history",
    "list_document_instances",
]

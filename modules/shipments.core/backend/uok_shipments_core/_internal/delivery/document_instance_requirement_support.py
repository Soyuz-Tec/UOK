from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok.kernel.security import Actor

from uok_shipments_core._internal.persistence.models import (
    ShipmentDocumentRequirement,
)

from .document_requirement_mutation_support import (
    append_requirement_history,
    assert_requirement_expected_version,
    emit_requirement_event,
    touch_requirement,
)


def require_matching_requirement(
    db: Session,
    actor: Actor,
    shipment_id: str,
    requirement_id: str,
    compliance_document_type_id: str,
    *,
    lock: bool = False,
) -> ShipmentDocumentRequirement:
    statement = select(ShipmentDocumentRequirement).where(
        ShipmentDocumentRequirement.id == requirement_id,
        ShipmentDocumentRequirement.organization_id == actor.organization_id,
        ShipmentDocumentRequirement.shipment_id == shipment_id,
        ShipmentDocumentRequirement.compliance_document_type_id
        == compliance_document_type_id,
    )
    if lock:
        statement = statement.with_for_update()
    row = db.scalar(statement)
    if row is None:
        raise ValueError("shipment document requirement is not available")
    return row


def mark_linked_requirement_received(
    db: Session,
    actor: Actor,
    shipment_id: str,
    requirement_id: str,
    compliance_document_type_id: str,
    expected_version: int,
    command_id: str,
    instance_id: str,
    reason: str,
) -> ShipmentDocumentRequirement:
    row = require_matching_requirement(
        db,
        actor,
        shipment_id,
        requirement_id,
        compliance_document_type_id,
        lock=True,
    )
    assert_requirement_expected_version(row, expected_version)
    if row.status != "missing":
        raise ValueError(
            "linked shipment document requirement must be missing before it can be received"
        )
    previous_status = row.status
    row.status = "received"
    touch_requirement(row, actor)
    coupled_reason = reason
    append_requirement_history(
        db,
        actor,
        row,
        "status_changed",
        coupled_reason,
    )
    db.flush()
    emit_requirement_event(
        db,
        actor,
        "ShipmentDocumentRequirementStatusChanged",
        row,
        command_id,
        {
            "previous_status": previous_status,
            "new_status": row.status,
            "reason": coupled_reason,
            "source_document_instance_id": instance_id,
        },
    )
    return row


__all__ = [
    "mark_linked_requirement_received",
    "require_matching_requirement",
]

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from uok.kernel.security import Actor
from uok.models_base import utcnow
from uok.module_events import emit_module_event

from uok_shipments_core._internal.persistence.models import (
    ShipmentDocumentRequirement,
    ShipmentDocumentRequirementHistory,
)


def assert_requirement_expected_version(
    row: ShipmentDocumentRequirement,
    expected_version: int,
) -> None:
    if row.version != expected_version:
        raise ValueError(
            "shipment document requirement changed; "
            f"expected version {expected_version}, current version {row.version}"
        )


def touch_requirement(
    row: ShipmentDocumentRequirement,
    actor: Actor,
) -> None:
    row.version += 1
    row.updated_by_user_id = actor.user_id
    row.updated_at = utcnow()


def append_requirement_history(
    db: Session,
    actor: Actor,
    row: ShipmentDocumentRequirement,
    action: str,
    reason: str,
) -> None:
    db.add(ShipmentDocumentRequirementHistory(
        organization_id=actor.organization_id,
        shipment_id=row.shipment_id,
        requirement_id=row.id,
        compliance_document_type_id=row.compliance_document_type_id,
        action=action,
        requirement_level=row.requirement_level,
        status=row.status,
        notes=row.notes,
        version=row.version,
        reason=reason,
        changed_by_user_id=actor.user_id,
    ))


def emit_requirement_event(
    db: Session,
    actor: Actor,
    event_type: str,
    row: ShipmentDocumentRequirement,
    command_id: str,
    extra: dict[str, Any] | None = None,
) -> None:
    emit_module_event(
        db,
        actor,
        event_type,
        "ShipmentDocumentRequirement",
        row.id,
        {
            "correlation_id": command_id,
            "shipment_id": row.shipment_id,
            "compliance_document_type_id": row.compliance_document_type_id,
            "requirement_level": row.requirement_level,
            "status": row.status,
            "version": row.version,
            **(extra or {}),
        },
    )


__all__ = [
    "append_requirement_history",
    "assert_requirement_expected_version",
    "emit_requirement_event",
    "touch_requirement",
]

from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy.orm import Session

from uok.kernel.security import Actor
from uok.models_base import utcnow
from uok.module_events import emit_module_event

from uok_shipments_core._internal.persistence.models import (
    ShipmentDocumentInstance,
    ShipmentDocumentInstanceHistory,
)

_ALLOWED_STATUS_TRANSITIONS = {
    "draft": frozenset({"recorded", "superseded"}),
    "recorded": frozenset({"verified", "rejected", "superseded"}),
    "rejected": frozenset({"recorded", "superseded"}),
    "verified": frozenset({"superseded"}),
    "superseded": frozenset(),
}
EDITABLE_INSTANCE_STATUSES = frozenset({"draft", "recorded", "rejected"})


def assert_instance_expected_version(
    row: ShipmentDocumentInstance,
    expected_version: int,
) -> None:
    if row.version != expected_version:
        raise ValueError(
            "shipment document instance changed; "
            f"expected version {expected_version}, current version {row.version}"
        )


def assert_instance_transition(
    row: ShipmentDocumentInstance,
    new_status: str,
) -> None:
    if new_status not in _ALLOWED_STATUS_TRANSITIONS[row.status]:
        raise ValueError(
            f"shipment document instance status cannot transition "
            f"from {row.status} to {new_status}"
        )


def touch_instance(
    row: ShipmentDocumentInstance,
    actor: Actor,
) -> None:
    row.version += 1
    row.updated_by_user_id = actor.user_id
    row.updated_at = utcnow()


def append_instance_history(
    db: Session,
    actor: Actor,
    row: ShipmentDocumentInstance,
    action: str,
    reason: str,
) -> None:
    db.add(ShipmentDocumentInstanceHistory(
        organization_id=actor.organization_id,
        shipment_id=row.shipment_id,
        instance_id=row.id,
        compliance_document_type_id=row.compliance_document_type_id,
        requirement_id=row.requirement_id,
        document_number=row.document_number,
        issuing_party_name=row.issuing_party_name,
        issued_on=row.issued_on,
        expires_on=row.expires_on,
        status=row.status,
        notes=row.notes,
        action=action,
        version=row.version,
        reason=reason,
        changed_by_user_id=actor.user_id,
    ))


def emit_instance_event(
    db: Session,
    actor: Actor,
    event_type: str,
    row: ShipmentDocumentInstance,
    command_id: str,
    extra: dict[str, Any] | None = None,
) -> None:
    emit_module_event(
        db,
        actor,
        event_type,
        "ShipmentDocumentInstance",
        row.id,
        {
            "correlation_id": command_id,
            "shipment_id": row.shipment_id,
            "compliance_document_type_id": row.compliance_document_type_id,
            "requirement_id": row.requirement_id,
            "document_number": row.document_number,
            "issued_on": _date_value(row.issued_on),
            "expires_on": _date_value(row.expires_on),
            "status": row.status,
            "version": row.version,
            **(extra or {}),
        },
    )


def _date_value(value: date | None) -> str | None:
    return None if value is None else value.isoformat()


__all__ = [
    "EDITABLE_INSTANCE_STATUSES",
    "append_instance_history",
    "assert_instance_expected_version",
    "assert_instance_transition",
    "emit_instance_event",
    "touch_instance",
]

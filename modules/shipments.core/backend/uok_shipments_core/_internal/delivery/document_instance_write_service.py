from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok.kernel.security import Actor
from uok.models_base import utcnow

from uok_shipments_core._internal.persistence.models import (
    Shipment,
    ShipmentDocumentInstance,
)

from .compliance_gateway import require_active_document_type
from .document_instance_mutation_support import (
    EDITABLE_INSTANCE_STATUSES,
    append_instance_history,
    assert_instance_expected_version,
    assert_instance_transition,
    emit_instance_event,
    touch_instance,
)
from .document_instance_read_service import document_instance_response
from .document_instance_requirement_support import (
    mark_linked_requirement_received,
    require_matching_requirement,
)
from .document_instance_schemas import (
    ShipmentDocumentInstanceCreateRequest,
    ShipmentDocumentInstanceStatusRequest,
    ShipmentDocumentInstanceUpdateRequest,
)

_MUTABLE_FIELDS = frozenset({
    "document_number",
    "issuing_party_name",
    "issued_on",
    "expires_on",
    "notes",
})


def create_document_instance(
    db: Session,
    actor: Actor,
    request: ShipmentDocumentInstanceCreateRequest,
    command_id: str,
) -> dict[str, Any]:
    _locked_shipment(db, actor, request.shipment_id)
    require_active_document_type(
        db,
        actor,
        request.compliance_document_type_id,
    )
    if request.requirement_id is not None:
        require_matching_requirement(
            db,
            actor,
            request.shipment_id,
            request.requirement_id,
            request.compliance_document_type_id,
            lock=True,
        )
    now = utcnow()
    row = ShipmentDocumentInstance(
        organization_id=actor.organization_id,
        shipment_id=request.shipment_id,
        compliance_document_type_id=request.compliance_document_type_id,
        requirement_id=request.requirement_id,
        document_number=request.document_number,
        issuing_party_name=request.issuing_party_name,
        issued_on=request.issued_on,
        expires_on=request.expires_on,
        status="draft",
        notes=request.notes,
        version=1,
        created_by_user_id=actor.user_id,
        updated_by_user_id=actor.user_id,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.flush()
    append_instance_history(
        db,
        actor,
        row,
        "created",
        "Document instance created.",
    )
    emit_instance_event(
        db,
        actor,
        "ShipmentDocumentInstanceCreated",
        row,
        command_id,
    )
    db.flush()
    return document_instance_response(db, actor, row, command_id)


def update_document_instance(
    db: Session,
    actor: Actor,
    request: ShipmentDocumentInstanceUpdateRequest,
    command_id: str,
) -> dict[str, Any]:
    row = _locked_instance(
        db,
        actor,
        request.shipment_id,
        request.instance_id,
    )
    assert_instance_expected_version(row, request.expected_version)
    if row.status not in EDITABLE_INSTANCE_STATUSES:
        raise ValueError(
            "shipment document instance metadata cannot be edited in its current status"
        )
    supplied = _MUTABLE_FIELDS.intersection(request.model_fields_set)
    if not supplied:
        raise ValueError("at least one shipment document instance field is required")
    if "document_number" in supplied and request.document_number is None:
        raise ValueError("document_number cannot be null")
    final_issued_on = (
        request.issued_on
        if "issued_on" in supplied
        else row.issued_on
    )
    final_expires_on = (
        request.expires_on
        if "expires_on" in supplied
        else row.expires_on
    )
    if (
        final_issued_on is not None
        and final_expires_on is not None
        and final_expires_on < final_issued_on
    ):
        raise ValueError("expires_on cannot be earlier than issued_on")
    changes = {
        field: getattr(request, field)
        for field in supplied
        if getattr(row, field) != getattr(request, field)
    }
    if not changes:
        raise ValueError("shipment document instance has no changes")
    for field, value in changes.items():
        setattr(row, field, value)
    touch_instance(row, actor)
    append_instance_history(db, actor, row, "updated", request.reason)
    db.flush()
    emit_instance_event(
        db,
        actor,
        "ShipmentDocumentInstanceUpdated",
        row,
        command_id,
        {
            "changed_fields": sorted(changes),
            "reason": request.reason,
        },
    )
    return document_instance_response(db, actor, row, command_id)


def set_document_instance_status(
    db: Session,
    actor: Actor,
    request: ShipmentDocumentInstanceStatusRequest,
    command_id: str,
) -> dict[str, Any]:
    row = _locked_instance(
        db,
        actor,
        request.shipment_id,
        request.instance_id,
    )
    assert_instance_expected_version(row, request.expected_version)
    assert_instance_transition(row, request.new_status)
    if request.mark_requirement_received and row.requirement_id is None:
        raise ValueError(
            "shipment document instance has no linked document requirement"
        )

    previous_status = row.status
    row.status = request.new_status
    touch_instance(row, actor)
    append_instance_history(db, actor, row, "status_changed", request.reason)
    db.flush()

    requirement_updated = False
    if request.mark_requirement_received:
        expected_requirement_version = request.expected_requirement_version
        if expected_requirement_version is None:
            raise ValueError(
                "expected_requirement_version is required when marking a requirement received"
            )
        mark_linked_requirement_received(
            db,
            actor,
            row.shipment_id,
            str(row.requirement_id),
            row.compliance_document_type_id,
            expected_requirement_version,
            command_id,
            row.id,
            request.reason,
        )
        requirement_updated = True
    emit_instance_event(
        db,
        actor,
        "ShipmentDocumentInstanceStatusChanged",
        row,
        command_id,
        {
            "previous_status": previous_status,
            "new_status": row.status,
            "reason": request.reason,
            "linked_requirement_updated": requirement_updated,
        },
    )
    db.flush()
    return document_instance_response(db, actor, row, command_id)


def _locked_shipment(
    db: Session,
    actor: Actor,
    shipment_id: str,
) -> Shipment:
    row = db.scalar(select(Shipment).where(
        Shipment.id == shipment_id,
        Shipment.organization_id == actor.organization_id,
    ).with_for_update())
    if row is None:
        raise ValueError("shipment not found")
    return row


def _locked_instance(
    db: Session,
    actor: Actor,
    shipment_id: str,
    instance_id: str,
) -> ShipmentDocumentInstance:
    _locked_shipment(db, actor, shipment_id)
    row = db.scalar(select(ShipmentDocumentInstance).where(
        ShipmentDocumentInstance.id == instance_id,
        ShipmentDocumentInstance.organization_id == actor.organization_id,
        ShipmentDocumentInstance.shipment_id == shipment_id,
    ).with_for_update())
    if row is None:
        raise ValueError("shipment document instance not found")
    return row


__all__ = [
    "create_document_instance",
    "set_document_instance_status",
    "update_document_instance",
]

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from uok.kernel.security import Actor
from uok.models_base import utcnow

from uok_shipments_core._internal.persistence.models import (
    Shipment,
    ShipmentDocumentInstance,
    ShipmentDocumentRequirement,
)

from .compliance_gateway import require_active_document_type
from .document_requirement_mutation_support import (
    append_requirement_history,
    assert_requirement_expected_version,
    emit_requirement_event,
    touch_requirement,
)
from .document_requirement_schemas import (
    ShipmentDocumentRequirementAddRequest,
    ShipmentDocumentRequirementRemoveRequest,
    ShipmentDocumentRequirementStatusRequest,
    ShipmentDocumentRequirementUpdateRequest,
)
from .document_requirement_read_service import requirement_response

_MUTABLE_FIELDS = frozenset({"requirement_level", "notes"})


def add_document_requirement(
    db: Session,
    actor: Actor,
    request: ShipmentDocumentRequirementAddRequest,
    command_id: str,
) -> dict[str, Any]:
    _locked_shipment(db, actor, request.shipment_id)
    require_active_document_type(
        db,
        actor,
        request.compliance_document_type_id,
    )
    existing_id = db.scalar(select(ShipmentDocumentRequirement.id).where(
        ShipmentDocumentRequirement.organization_id == actor.organization_id,
        ShipmentDocumentRequirement.shipment_id == request.shipment_id,
        ShipmentDocumentRequirement.compliance_document_type_id
        == request.compliance_document_type_id,
    ))
    if existing_id is not None:
        raise ValueError("document type requirement already exists for this shipment")

    now = utcnow()
    row = ShipmentDocumentRequirement(
        organization_id=actor.organization_id,
        shipment_id=request.shipment_id,
        compliance_document_type_id=request.compliance_document_type_id,
        requirement_level=request.requirement_level,
        status="missing",
        notes=request.notes,
        version=1,
        created_by_user_id=actor.user_id,
        updated_by_user_id=actor.user_id,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    try:
        db.flush()
    except IntegrityError as exc:
        raise ValueError(
            "document type requirement already exists for this shipment"
        ) from exc
    append_requirement_history(db, actor, row, "added", "Requirement added.")
    emit_requirement_event(
        db,
        actor,
        "ShipmentDocumentRequirementAdded",
        row,
        command_id,
        {"reason": "Requirement added."},
    )
    db.flush()
    return requirement_response(db, actor, row, command_id)


def update_document_requirement(
    db: Session,
    actor: Actor,
    request: ShipmentDocumentRequirementUpdateRequest,
    command_id: str,
) -> dict[str, Any]:
    row = _locked_requirement(
        db,
        actor,
        request.shipment_id,
        request.requirement_id,
    )
    assert_requirement_expected_version(row, request.expected_version)
    supplied = _MUTABLE_FIELDS.intersection(request.model_fields_set)
    if not supplied:
        raise ValueError("at least one document requirement field is required")
    if "requirement_level" in supplied and request.requirement_level is None:
        raise ValueError("requirement_level cannot be null")
    changes = {
        field: getattr(request, field)
        for field in supplied
        if getattr(row, field) != getattr(request, field)
    }
    if not changes:
        raise ValueError("shipment document requirement has no changes")
    for field, value in changes.items():
        setattr(row, field, value)
    touch_requirement(row, actor)
    append_requirement_history(db, actor, row, "updated", request.reason)
    db.flush()
    emit_requirement_event(
        db,
        actor,
        "ShipmentDocumentRequirementUpdated",
        row,
        command_id,
        {"changed_fields": sorted(changes), "reason": request.reason},
    )
    return requirement_response(db, actor, row, command_id)


def set_document_requirement_status(
    db: Session,
    actor: Actor,
    request: ShipmentDocumentRequirementStatusRequest,
    command_id: str,
) -> dict[str, Any]:
    row = _locked_requirement(
        db,
        actor,
        request.shipment_id,
        request.requirement_id,
    )
    assert_requirement_expected_version(row, request.expected_version)
    if row.status == request.new_status:
        raise ValueError("shipment document requirement already has this status")
    previous_status = row.status
    row.status = request.new_status
    touch_requirement(row, actor)
    append_requirement_history(db, actor, row, "status_changed", request.reason)
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
            "reason": request.reason,
        },
    )
    return requirement_response(db, actor, row, command_id)


def remove_document_requirement(
    db: Session,
    actor: Actor,
    request: ShipmentDocumentRequirementRemoveRequest,
    command_id: str,
) -> dict[str, Any]:
    row = _locked_requirement(
        db,
        actor,
        request.shipment_id,
        request.requirement_id,
    )
    assert_requirement_expected_version(row, request.expected_version)
    if db.scalar(select(ShipmentDocumentInstance.id).where(
        ShipmentDocumentInstance.organization_id == actor.organization_id,
        ShipmentDocumentInstance.shipment_id == request.shipment_id,
        ShipmentDocumentInstance.requirement_id == request.requirement_id,
    )) is not None:
        raise ValueError(
            "shipment document requirement is linked to retained document metadata"
        )
    touch_requirement(row, actor)
    append_requirement_history(db, actor, row, "removed", request.reason)
    db.flush()
    emit_requirement_event(
        db,
        actor,
        "ShipmentDocumentRequirementRemoved",
        row,
        command_id,
        {"reason": request.reason},
    )
    result = {
        "id": row.id,
        "shipment_id": row.shipment_id,
        "removed": True,
        "version": row.version,
        "correlation_id": command_id,
    }
    db.delete(row)
    db.flush()
    return result


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


def _locked_requirement(
    db: Session,
    actor: Actor,
    shipment_id: str,
    requirement_id: str,
) -> ShipmentDocumentRequirement:
    _locked_shipment(db, actor, shipment_id)
    row = db.scalar(select(ShipmentDocumentRequirement).where(
        ShipmentDocumentRequirement.id == requirement_id,
        ShipmentDocumentRequirement.organization_id == actor.organization_id,
        ShipmentDocumentRequirement.shipment_id == shipment_id,
    ).with_for_update())
    if row is None:
        raise ValueError("shipment document requirement not found")
    return row


__all__ = [
    "add_document_requirement",
    "remove_document_requirement",
    "set_document_requirement_status",
    "update_document_requirement",
]

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from uok.kernel.security import Actor
from uok.models_base import utcnow

from uok_compliance_core._internal.persistence.models import (
    ComplianceDocumentType,
    ComplianceDocumentTypeNameHistory,
)

from .mutation_support import (
    assert_expected_version,
    emit_compliance_document_type_event,
    locked_compliance_document_type,
    touch_compliance_document_type,
)
from .read_service import compliance_document_type_response
from .schemas import (
    ComplianceDocumentTypeCreateRequest,
    ComplianceDocumentTypeUpdateRequest,
)

_MUTABLE_FIELDS = frozenset({"canonical_name", "description", "category"})


def create_compliance_document_type(
    db: Session,
    actor: Actor,
    request: ComplianceDocumentTypeCreateRequest,
    command_id: str,
) -> dict[str, Any]:
    existing = db.scalar(
        select(ComplianceDocumentType.id).where(
            ComplianceDocumentType.organization_id == actor.organization_id,
            ComplianceDocumentType.code == request.code,
        )
    )
    if existing is not None:
        raise ValueError(
            "compliance document type code already exists in this organization"
        )
    now = utcnow()
    row = ComplianceDocumentType(
        organization_id=actor.organization_id,
        code=request.code,
        canonical_name=request.canonical_name,
        description=request.description,
        category=request.category,
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
            "compliance document type code already exists in this organization"
        ) from exc
    emit_compliance_document_type_event(
        db,
        actor,
        "ComplianceDocumentTypeCreated",
        row,
        command_id,
    )
    return compliance_document_type_response(row, command_id)


def update_compliance_document_type(
    db: Session,
    actor: Actor,
    request: ComplianceDocumentTypeUpdateRequest,
    command_id: str,
) -> dict[str, Any]:
    row = locked_compliance_document_type(
        db,
        actor,
        request.compliance_document_type_id,
    )
    assert_expected_version(row, request.expected_version)
    if row.status == "archived":
        raise ValueError(
            "archived compliance document type must be restored before update"
        )
    supplied = _MUTABLE_FIELDS.intersection(request.model_fields_set)
    if not supplied:
        raise ValueError("at least one compliance document type field is required")
    if "canonical_name" in supplied and request.canonical_name is None:
        raise ValueError("canonical_name cannot be null")
    changes = {
        field: getattr(request, field)
        for field in supplied
        if getattr(row, field) != getattr(request, field)
    }
    if not changes:
        raise ValueError("compliance document type has no changes")
    previous_name = row.canonical_name
    for field, value in changes.items():
        setattr(row, field, value)
    if row.canonical_name != previous_name:
        db.add(
            ComplianceDocumentTypeNameHistory(
                organization_id=actor.organization_id,
                compliance_document_type_id=row.id,
                previous_name=previous_name,
                new_name=row.canonical_name,
                reason=request.reason,
                changed_by_user_id=actor.user_id,
            )
        )
    touch_compliance_document_type(row, actor)
    db.flush()
    emit_compliance_document_type_event(
        db,
        actor,
        "ComplianceDocumentTypeUpdated",
        row,
        command_id,
        {"changed_fields": sorted(changes), "reason": request.reason},
    )
    return compliance_document_type_response(row, command_id)


__all__ = [
    "create_compliance_document_type",
    "update_compliance_document_type",
]

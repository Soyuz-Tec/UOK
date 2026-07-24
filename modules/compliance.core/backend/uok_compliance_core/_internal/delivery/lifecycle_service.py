from __future__ import annotations

from collections.abc import Collection
from typing import Any

from sqlalchemy.orm import Session

from uok.kernel.security import Actor
from uok.models_base import utcnow

from .mutation_support import (
    assert_expected_version,
    emit_compliance_document_type_event,
    locked_compliance_document_type,
    touch_compliance_document_type,
)
from .read_service import compliance_document_type_response
from .schemas import ComplianceDocumentTypeLifecycleRequest


def deactivate_compliance_document_type(
    db: Session,
    actor: Actor,
    request: ComplianceDocumentTypeLifecycleRequest,
    command_id: str,
) -> dict[str, Any]:
    return _transition(
        db,
        actor,
        request,
        command_id,
        allowed_from={"active"},
        new_status="inactive",
        event_type="ComplianceDocumentTypeDeactivated",
    )


def activate_compliance_document_type(
    db: Session,
    actor: Actor,
    request: ComplianceDocumentTypeLifecycleRequest,
    command_id: str,
) -> dict[str, Any]:
    return _transition(
        db,
        actor,
        request,
        command_id,
        allowed_from={"inactive"},
        new_status="active",
        event_type="ComplianceDocumentTypeActivated",
    )


def archive_compliance_document_type(
    db: Session,
    actor: Actor,
    request: ComplianceDocumentTypeLifecycleRequest,
    command_id: str,
) -> dict[str, Any]:
    return _transition(
        db,
        actor,
        request,
        command_id,
        allowed_from={"active", "inactive"},
        new_status="archived",
        event_type="ComplianceDocumentTypeArchived",
    )


def restore_compliance_document_type(
    db: Session,
    actor: Actor,
    request: ComplianceDocumentTypeLifecycleRequest,
    command_id: str,
) -> dict[str, Any]:
    return _transition(
        db,
        actor,
        request,
        command_id,
        allowed_from={"archived"},
        new_status="active",
        event_type="ComplianceDocumentTypeRestored",
    )


def _transition(
    db: Session,
    actor: Actor,
    request: ComplianceDocumentTypeLifecycleRequest,
    command_id: str,
    *,
    allowed_from: Collection[str],
    new_status: str,
    event_type: str,
) -> dict[str, Any]:
    row = locked_compliance_document_type(
        db,
        actor,
        request.compliance_document_type_id,
    )
    assert_expected_version(row, request.expected_version)
    if row.status not in allowed_from:
        raise ValueError(
            "compliance document type status cannot transition "
            f"from {row.status} to {new_status}"
        )
    previous_status = row.status
    row.status = new_status
    row.archived_at = utcnow() if new_status == "archived" else None
    touch_compliance_document_type(row, actor)
    db.flush()
    emit_compliance_document_type_event(
        db,
        actor,
        event_type,
        row,
        command_id,
        {
            "previous_status": previous_status,
            "new_status": new_status,
            "reason": request.reason,
        },
    )
    return compliance_document_type_response(row, command_id)


__all__ = [
    "activate_compliance_document_type",
    "archive_compliance_document_type",
    "deactivate_compliance_document_type",
    "restore_compliance_document_type",
]

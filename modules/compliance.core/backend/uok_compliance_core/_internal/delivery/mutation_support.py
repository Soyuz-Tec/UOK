from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok.kernel.security import Actor
from uok.models_base import utcnow
from uok.module_events import emit_module_event

from uok_compliance_core._internal.persistence.models import ComplianceDocumentType


def locked_compliance_document_type(
    db: Session,
    actor: Actor,
    compliance_document_type_id: str,
) -> ComplianceDocumentType:
    row = db.scalar(
        select(ComplianceDocumentType)
        .where(
            ComplianceDocumentType.id == compliance_document_type_id,
            ComplianceDocumentType.organization_id == actor.organization_id,
        )
        .with_for_update()
    )
    if row is None:
        raise ValueError("compliance document type not found")
    return row


def assert_expected_version(
    row: ComplianceDocumentType,
    expected_version: int,
) -> None:
    if row.version != expected_version:
        raise ValueError(
            "compliance document type changed; "
            f"expected version {expected_version}, current version {row.version}"
        )


def touch_compliance_document_type(
    row: ComplianceDocumentType,
    actor: Actor,
) -> None:
    row.version += 1
    row.updated_by_user_id = actor.user_id
    row.updated_at = utcnow()


def emit_compliance_document_type_event(
    db: Session,
    actor: Actor,
    event_type: str,
    row: ComplianceDocumentType,
    command_id: str,
    extra: dict[str, Any] | None = None,
) -> None:
    emit_module_event(
        db,
        actor,
        event_type,
        "ComplianceDocumentType",
        row.id,
        {
            "correlation_id": command_id,
            "code": row.code,
            "status": row.status,
            "version": row.version,
            **(extra or {}),
        },
    )


__all__ = [
    "assert_expected_version",
    "emit_compliance_document_type_event",
    "locked_compliance_document_type",
    "touch_compliance_document_type",
]

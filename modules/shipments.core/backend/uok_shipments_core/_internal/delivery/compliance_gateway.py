from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy.orm import Session

from uok.kernel.security import Actor
from uok_compliance_core.public_api import (
    ComplianceDocumentTypeReferenceDTO,
    resolve_compliance_document_type_references,
)


def active_document_type_options(
    db: Session,
    actor: Actor,
) -> list[dict[str, object]]:
    return [
        document_type_resolution_response(value)
        for value in resolve_compliance_document_type_references(db, actor)
    ]


def require_active_document_type(
    db: Session,
    actor: Actor,
    compliance_document_type_id: str,
) -> ComplianceDocumentTypeReferenceDTO:
    resolution = resolve_compliance_document_type_references(
        db,
        actor,
        (compliance_document_type_id,),
    )[0]
    if resolution.status != "ready":
        raise ValueError("compliance document type is not active or visible")
    return resolution


def resolve_document_types(
    db: Session,
    actor: Actor,
    compliance_document_type_ids: Iterable[str],
) -> tuple[ComplianceDocumentTypeReferenceDTO, ...]:
    return resolve_compliance_document_type_references(
        db,
        actor,
        compliance_document_type_ids,
    )


def document_type_resolution_response(
    value: ComplianceDocumentTypeReferenceDTO,
) -> dict[str, object]:
    visible_id = (
        value.compliance_document_type_id
        if value.code is not None and value.canonical_name is not None
        else None
    )
    return {
        "compliance_document_type_id": visible_id,
        "status": value.status,
        "code": value.code,
        "canonical_name": value.canonical_name,
        "category": value.category,
        "lifecycle_status": value.lifecycle_status,
        "status_summary": value.status_summary,
    }


__all__ = [
    "active_document_type_options",
    "document_type_resolution_response",
    "require_active_document_type",
    "resolve_document_types",
]

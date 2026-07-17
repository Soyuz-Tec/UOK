from __future__ import annotations

from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from uok.kernel.security import Actor

from uok_compliance_core._internal.persistence.models import (
    ComplianceDocumentType,
    ComplianceDocumentTypeNameHistory,
)

from .schemas import (
    ComplianceDocumentTypeNameHistoryResponse,
    ComplianceDocumentTypeResponse,
)


def list_compliance_document_types(
    db: Session,
    actor: Actor,
    *,
    include_archived: bool = False,
    status: str | None = None,
    search: str | None = None,
    category: str | None = None,
) -> list[dict[str, Any]]:
    statement = select(ComplianceDocumentType).where(
        ComplianceDocumentType.organization_id == actor.organization_id
    )
    if status is not None:
        statement = statement.where(ComplianceDocumentType.status == status)
    elif not include_archived:
        statement = statement.where(ComplianceDocumentType.status != "archived")
    if search and search.strip():
        term = f"%{search.strip()}%"
        statement = statement.where(
            or_(
                ComplianceDocumentType.code.ilike(term),
                ComplianceDocumentType.canonical_name.ilike(term),
                ComplianceDocumentType.description.ilike(term),
                ComplianceDocumentType.category.ilike(term),
            )
        )
    if category and category.strip():
        statement = statement.where(
            ComplianceDocumentType.category.ilike(category.strip())
        )
    rows = db.scalars(
        statement.order_by(
            ComplianceDocumentType.canonical_name,
            ComplianceDocumentType.code,
        )
    ).all()
    return [compliance_document_type_response(row) for row in rows]


def get_compliance_document_type(
    db: Session,
    actor: Actor,
    compliance_document_type_id: str,
) -> ComplianceDocumentType:
    row = db.scalar(
        select(ComplianceDocumentType).where(
            ComplianceDocumentType.id == compliance_document_type_id,
            ComplianceDocumentType.organization_id == actor.organization_id,
        )
    )
    if row is None:
        raise ValueError("compliance document type not found")
    return row


def list_compliance_document_type_name_history(
    db: Session,
    actor: Actor,
    compliance_document_type_id: str,
) -> list[dict[str, Any]]:
    get_compliance_document_type(db, actor, compliance_document_type_id)
    rows = db.scalars(
        select(ComplianceDocumentTypeNameHistory)
        .where(
            ComplianceDocumentTypeNameHistory.organization_id
            == actor.organization_id,
            ComplianceDocumentTypeNameHistory.compliance_document_type_id
            == compliance_document_type_id,
        )
        .order_by(
            ComplianceDocumentTypeNameHistory.changed_at.desc(),
            ComplianceDocumentTypeNameHistory.id.desc(),
        )
    ).all()
    return [
        ComplianceDocumentTypeNameHistoryResponse.model_validate(
            row,
            from_attributes=True,
        ).model_dump(mode="json")
        for row in rows
    ]


def compliance_document_type_response(
    row: ComplianceDocumentType,
    correlation_id: str | None = None,
) -> dict[str, Any]:
    result = ComplianceDocumentTypeResponse.model_validate(
        row,
        from_attributes=True,
    ).model_dump(mode="json")
    if correlation_id is not None:
        result["correlation_id"] = correlation_id
    return result


__all__ = [
    "compliance_document_type_response",
    "get_compliance_document_type",
    "list_compliance_document_type_name_history",
    "list_compliance_document_types",
]

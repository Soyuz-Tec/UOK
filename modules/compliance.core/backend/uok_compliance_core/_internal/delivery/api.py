from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from uok.host.database import get_db
from uok.host.security import current_actor
from uok.kernel.module_runtime import ensure_module_operational
from uok.kernel.security import Actor, require_permission

from .read_service import (
    compliance_document_type_response,
    get_compliance_document_type,
    list_compliance_document_type_name_history,
    list_compliance_document_types,
)
from .schemas import (
    ComplianceDocumentTypeNameHistoryResponse,
    ComplianceDocumentTypeResponse,
    ComplianceDocumentTypeStatus,
)

router = APIRouter(prefix="/api/compliance", tags=["compliance"])


@router.get(
    "/document-types",
    response_model=list[ComplianceDocumentTypeResponse],
)
def document_types(
    include_archived: bool = False,
    status: ComplianceDocumentTypeStatus | None = None,
    search: str | None = None,
    category: str | None = None,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    _require_read_access(db, actor)
    return list_compliance_document_types(
        db,
        actor,
        include_archived=include_archived,
        status=status,
        search=search,
        category=category,
    )


@router.get(
    "/document-types/{compliance_document_type_id}",
    response_model=ComplianceDocumentTypeResponse,
)
def document_type(
    compliance_document_type_id: str,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    _require_read_access(db, actor)
    try:
        row = get_compliance_document_type(
            db,
            actor,
            compliance_document_type_id,
        )
        return compliance_document_type_response(row)
    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail={"error": str(exc)},
        ) from exc


@router.get(
    "/document-types/{compliance_document_type_id}/name-history",
    response_model=list[ComplianceDocumentTypeNameHistoryResponse],
)
def name_history(
    compliance_document_type_id: str,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    _require_read_access(db, actor)
    try:
        return list_compliance_document_type_name_history(
            db,
            actor,
            compliance_document_type_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail={"error": str(exc)},
        ) from exc


def _require_read_access(db: Session, actor: Actor) -> None:
    try:
        require_permission(actor, "compliance.read")
        ensure_module_operational(
            db,
            actor.organization_id,
            "compliance.core",
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=403,
            detail=f"Permission denied: {exc}",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"error": str(exc)},
        ) from exc

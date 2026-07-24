from __future__ import annotations

from typing import Any, Callable, TypeVar

from pydantic import BaseModel, ValidationError
from sqlalchemy.orm import Session

from uok.kernel.command_contracts import COMMAND_IF_MATCH_CONTEXT_KEY
from uok.kernel.security import Actor

from .lifecycle_service import (
    activate_compliance_document_type,
    archive_compliance_document_type,
    deactivate_compliance_document_type,
    restore_compliance_document_type,
)
from .schemas import (
    ComplianceDocumentTypeCreateRequest,
    ComplianceDocumentTypeLifecycleRequest,
    ComplianceDocumentTypeUpdateRequest,
)
from .write_service import (
    create_compliance_document_type,
    update_compliance_document_type,
)

CommandHandler = Callable[[Session, Actor, dict[str, Any], str], dict[str, Any]]
RequestModel = TypeVar("RequestModel", bound=BaseModel)


def cmd_create_compliance_document_type(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    request = _validate(ComplianceDocumentTypeCreateRequest, payload)
    return create_compliance_document_type(db, actor, request, command_id)


def cmd_update_compliance_document_type(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    request = _validate(ComplianceDocumentTypeUpdateRequest, payload)
    return update_compliance_document_type(db, actor, request, command_id)


def cmd_deactivate_compliance_document_type(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    request = _validate(ComplianceDocumentTypeLifecycleRequest, payload)
    return deactivate_compliance_document_type(db, actor, request, command_id)


def cmd_activate_compliance_document_type(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    request = _validate(ComplianceDocumentTypeLifecycleRequest, payload)
    return activate_compliance_document_type(db, actor, request, command_id)


def cmd_archive_compliance_document_type(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    request = _validate(ComplianceDocumentTypeLifecycleRequest, payload)
    return archive_compliance_document_type(db, actor, request, command_id)


def cmd_restore_compliance_document_type(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    request = _validate(ComplianceDocumentTypeLifecycleRequest, payload)
    return restore_compliance_document_type(db, actor, request, command_id)


def command_handlers() -> dict[str, CommandHandler]:
    return {
        "CreateComplianceDocumentType": cmd_create_compliance_document_type,
        "UpdateComplianceDocumentType": cmd_update_compliance_document_type,
        "DeactivateComplianceDocumentType": (
            cmd_deactivate_compliance_document_type
        ),
        "ActivateComplianceDocumentType": cmd_activate_compliance_document_type,
        "ArchiveComplianceDocumentType": cmd_archive_compliance_document_type,
        "RestoreComplianceDocumentType": cmd_restore_compliance_document_type,
    }


def command_permissions() -> dict[str, str]:
    return {
        command_name: "compliance.manage"
        for command_name in command_handlers()
    }


def _validate(
    model: type[RequestModel],
    payload: dict[str, Any],
) -> RequestModel:
    clean_payload = {
        key: value
        for key, value in payload.items()
        if key != COMMAND_IF_MATCH_CONTEXT_KEY
    }
    try:
        return model.model_validate(clean_payload)
    except ValidationError as exc:
        message = exc.errors()[0].get(
            "msg",
            "invalid compliance document type request",
        )
        raise ValueError(message) from exc


__all__ = ["command_handlers", "command_permissions"]

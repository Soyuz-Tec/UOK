from __future__ import annotations

from typing import Any, Callable, TypeVar

from pydantic import BaseModel, ValidationError
from sqlalchemy.orm import Session

from uok.kernel.command_contracts import COMMAND_IF_MATCH_CONTEXT_KEY
from uok.kernel.security import Actor

from .document_instance_schemas import (
    ShipmentDocumentInstanceCreateRequest,
    ShipmentDocumentInstanceStatusRequest,
    ShipmentDocumentInstanceUpdateRequest,
)
from .document_instance_write_service import (
    create_document_instance,
    set_document_instance_status,
    update_document_instance,
)
from .document_requirement_schemas import (
    ShipmentDocumentRequirementAddRequest,
    ShipmentDocumentRequirementRemoveRequest,
    ShipmentDocumentRequirementStatusRequest,
    ShipmentDocumentRequirementUpdateRequest,
)
from .document_requirement_write_service import (
    add_document_requirement,
    remove_document_requirement,
    set_document_requirement_status,
    update_document_requirement,
)
from .schemas import ShipmentCreateRequest, ShipmentTransitionRequest, ShipmentUpdateRequest
from .write_service import create_shipment, transition_shipment_status, update_shipment

CommandHandler = Callable[[Session, Actor, dict[str, Any], str], dict[str, Any]]
RequestModel = TypeVar("RequestModel", bound=BaseModel)


def cmd_create_shipment(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    return create_shipment(db, actor, _validate(ShipmentCreateRequest, payload), command_id)


def cmd_update_shipment(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    return update_shipment(db, actor, _validate(ShipmentUpdateRequest, payload), command_id)


def cmd_transition_shipment_status(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    return transition_shipment_status(db, actor, _validate(ShipmentTransitionRequest, payload), command_id)


def cmd_create_shipment_document_instance(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    return create_document_instance(
        db,
        actor,
        _validate(ShipmentDocumentInstanceCreateRequest, payload),
        command_id,
    )


def cmd_update_shipment_document_instance(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    return update_document_instance(
        db,
        actor,
        _validate(ShipmentDocumentInstanceUpdateRequest, payload),
        command_id,
    )


def cmd_set_shipment_document_instance_status(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    return set_document_instance_status(
        db,
        actor,
        _validate(ShipmentDocumentInstanceStatusRequest, payload),
        command_id,
    )


def cmd_add_shipment_document_requirement(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    return add_document_requirement(
        db,
        actor,
        _validate(ShipmentDocumentRequirementAddRequest, payload),
        command_id,
    )


def cmd_update_shipment_document_requirement(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    return update_document_requirement(
        db,
        actor,
        _validate(ShipmentDocumentRequirementUpdateRequest, payload),
        command_id,
    )


def cmd_set_shipment_document_requirement_status(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    return set_document_requirement_status(
        db,
        actor,
        _validate(ShipmentDocumentRequirementStatusRequest, payload),
        command_id,
    )


def cmd_remove_shipment_document_requirement(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    return remove_document_requirement(
        db,
        actor,
        _validate(ShipmentDocumentRequirementRemoveRequest, payload),
        command_id,
    )


def command_handlers() -> dict[str, CommandHandler]:
    return {
        "AddShipmentDocumentRequirement": cmd_add_shipment_document_requirement,
        "CreateShipment": cmd_create_shipment,
        "CreateShipmentDocumentInstance": cmd_create_shipment_document_instance,
        "RemoveShipmentDocumentRequirement": cmd_remove_shipment_document_requirement,
        "SetShipmentDocumentInstanceStatus": cmd_set_shipment_document_instance_status,
        "SetShipmentDocumentRequirementStatus": cmd_set_shipment_document_requirement_status,
        "UpdateShipment": cmd_update_shipment,
        "UpdateShipmentDocumentInstance": cmd_update_shipment_document_instance,
        "UpdateShipmentDocumentRequirement": cmd_update_shipment_document_requirement,
        "TransitionShipmentStatus": cmd_transition_shipment_status,
    }


def command_permissions() -> dict[str, str]:
    return {command_name: "shipments.manage" for command_name in command_handlers()}


def _validate(model: type[RequestModel], payload: dict[str, Any]) -> RequestModel:
    clean_payload = {key: value for key, value in payload.items() if key != COMMAND_IF_MATCH_CONTEXT_KEY}
    try:
        return model.model_validate(clean_payload)
    except ValidationError as exc:
        raise ValueError(exc.errors()[0].get("msg", "invalid shipment request")) from exc


__all__ = ["command_handlers", "command_permissions"]

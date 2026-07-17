from __future__ import annotations

from typing import Any, Callable, TypeVar

from pydantic import BaseModel, ValidationError
from sqlalchemy.orm import Session

from uok.kernel.command_contracts import COMMAND_IF_MATCH_CONTEXT_KEY
from uok.kernel.security import Actor

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


def command_handlers() -> dict[str, CommandHandler]:
    return {
        "CreateShipment": cmd_create_shipment,
        "UpdateShipment": cmd_update_shipment,
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

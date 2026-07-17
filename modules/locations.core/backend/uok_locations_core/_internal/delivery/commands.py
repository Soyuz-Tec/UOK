from __future__ import annotations

from typing import Any, Callable, TypeVar

from pydantic import BaseModel, ValidationError
from sqlalchemy.orm import Session

from uok.kernel.command_contracts import COMMAND_IF_MATCH_CONTEXT_KEY
from uok.kernel.security import Actor

from .schemas import LocationDefinitionCreateRequest, LocationDefinitionUpdateRequest, LocationDefinitionVersionRequest
from .service import (
    archive_location_definition,
    create_location_definition,
    restore_location_definition,
    update_location_definition,
)

CommandHandler = Callable[[Session, Actor, dict[str, Any], str], dict[str, Any]]
RequestModel = TypeVar("RequestModel", bound=BaseModel)


def cmd_create_location_definition(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    return create_location_definition(db, actor, _validate(LocationDefinitionCreateRequest, payload), command_id)


def cmd_update_location_definition(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    return update_location_definition(db, actor, _validate(LocationDefinitionUpdateRequest, payload), command_id)


def cmd_archive_location_definition(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    return archive_location_definition(db, actor, _validate(LocationDefinitionVersionRequest, payload), command_id)


def cmd_restore_location_definition(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    return restore_location_definition(db, actor, _validate(LocationDefinitionVersionRequest, payload), command_id)


def command_handlers() -> dict[str, CommandHandler]:
    return {
        "CreateLocationDefinition": cmd_create_location_definition,
        "UpdateLocationDefinition": cmd_update_location_definition,
        "ArchiveLocationDefinition": cmd_archive_location_definition,
        "RestoreLocationDefinition": cmd_restore_location_definition,
    }


def command_permissions() -> dict[str, str]:
    return {command_name: "locations.manage" for command_name in command_handlers()}


def _validate(model: type[RequestModel], payload: dict[str, Any]) -> RequestModel:
    clean_payload = {key: value for key, value in payload.items() if key != COMMAND_IF_MATCH_CONTEXT_KEY}
    try:
        return model.model_validate(clean_payload)
    except ValidationError as exc:
        raise ValueError(exc.errors()[0].get("msg", "invalid location definition request")) from exc

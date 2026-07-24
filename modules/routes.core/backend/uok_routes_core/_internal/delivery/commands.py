from __future__ import annotations

from typing import Any, Callable, TypeVar

from pydantic import BaseModel, ValidationError
from sqlalchemy.orm import Session

from uok.kernel.command_contracts import COMMAND_IF_MATCH_CONTEXT_KEY
from uok.kernel.security import Actor

from .schemas import RouteDefinitionCreateRequest, RouteDefinitionUpdateRequest, RouteDefinitionVersionRequest
from .write_service import (
    archive_route_definition,
    create_route_definition,
    restore_route_definition,
    update_route_definition,
)

CommandHandler = Callable[[Session, Actor, dict[str, Any], str], dict[str, Any]]
RequestModel = TypeVar("RequestModel", bound=BaseModel)


def cmd_create_route_definition(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    return create_route_definition(db, actor, _validate(RouteDefinitionCreateRequest, payload), command_id)


def cmd_update_route_definition(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    return update_route_definition(db, actor, _validate(RouteDefinitionUpdateRequest, payload), command_id)


def cmd_archive_route_definition(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    return archive_route_definition(db, actor, _validate(RouteDefinitionVersionRequest, payload), command_id)


def cmd_restore_route_definition(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    return restore_route_definition(db, actor, _validate(RouteDefinitionVersionRequest, payload), command_id)


def command_handlers() -> dict[str, CommandHandler]:
    return {
        "CreateRouteDefinition": cmd_create_route_definition,
        "UpdateRouteDefinition": cmd_update_route_definition,
        "ArchiveRouteDefinition": cmd_archive_route_definition,
        "RestoreRouteDefinition": cmd_restore_route_definition,
    }


def command_permissions() -> dict[str, str]:
    return {command_name: "routes.manage" for command_name in command_handlers()}


def _validate(model: type[RequestModel], payload: dict[str, Any]) -> RequestModel:
    clean_payload = {key: value for key, value in payload.items() if key != COMMAND_IF_MATCH_CONTEXT_KEY}
    try:
        return model.model_validate(clean_payload)
    except ValidationError as exc:
        raise ValueError(exc.errors()[0].get("msg", "invalid route definition request")) from exc

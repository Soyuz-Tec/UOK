from __future__ import annotations

from typing import Any, Callable, TypeVar

from pydantic import BaseModel, ValidationError
from sqlalchemy.orm import Session

from uok.kernel.command_contracts import COMMAND_IF_MATCH_CONTEXT_KEY
from uok.kernel.security import Actor

from .schemas import ProductDefinitionCreateRequest, ProductDefinitionUpdateRequest, ProductDefinitionVersionRequest
from .service import (
    archive_product_definition,
    create_product_definition,
    restore_product_definition,
    update_product_definition,
)

CommandHandler = Callable[[Session, Actor, dict[str, Any], str], dict[str, Any]]
RequestModel = TypeVar("RequestModel", bound=BaseModel)


def cmd_create_product_definition(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    return create_product_definition(db, actor, _validate(ProductDefinitionCreateRequest, payload), command_id)


def cmd_update_product_definition(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    return update_product_definition(db, actor, _validate(ProductDefinitionUpdateRequest, payload), command_id)


def cmd_archive_product_definition(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    return archive_product_definition(db, actor, _validate(ProductDefinitionVersionRequest, payload), command_id)


def cmd_restore_product_definition(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    return restore_product_definition(db, actor, _validate(ProductDefinitionVersionRequest, payload), command_id)


def command_handlers() -> dict[str, CommandHandler]:
    return {
        "CreateProductDefinition": cmd_create_product_definition,
        "UpdateProductDefinition": cmd_update_product_definition,
        "ArchiveProductDefinition": cmd_archive_product_definition,
        "RestoreProductDefinition": cmd_restore_product_definition,
    }


def command_permissions() -> dict[str, str]:
    return {command_name: "products.manage" for command_name in command_handlers()}


def _validate(model: type[RequestModel], payload: dict[str, Any]) -> RequestModel:
    clean_payload = {key: value for key, value in payload.items() if key != COMMAND_IF_MATCH_CONTEXT_KEY}
    try:
        return model.model_validate(clean_payload)
    except ValidationError as exc:
        raise ValueError(exc.errors()[0].get("msg", "invalid product definition request")) from exc

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from uok.kernel.security import Actor
from uok.models_base import utcnow
from uok.module_events import emit_module_event

from uok_product_master._internal.persistence.models import ProductDefinition, ProductNameHistory

from .schemas import (
    ProductDefinitionCreateRequest,
    ProductDefinitionResponse,
    ProductDefinitionUpdateRequest,
    ProductDefinitionVersionRequest,
    ProductNameHistoryResponse,
)

_MUTABLE_FIELDS = frozenset({"canonical_name", "category", "grade", "specification", "base_unit_code"})


def list_product_definitions(db: Session, actor: Actor, include_archived: bool = False) -> list[dict[str, Any]]:
    statement = select(ProductDefinition).where(ProductDefinition.organization_id == actor.organization_id)
    if not include_archived:
        statement = statement.where(ProductDefinition.status == "active")
    rows = db.scalars(statement.order_by(ProductDefinition.canonical_name, ProductDefinition.code)).all()
    return [product_definition_response(row) for row in rows]


def get_product_definition(db: Session, actor: Actor, product_definition_id: str) -> ProductDefinition:
    row = db.scalar(select(ProductDefinition).where(
        ProductDefinition.id == product_definition_id,
        ProductDefinition.organization_id == actor.organization_id,
    ))
    if row is None:
        raise ValueError("product definition not found")
    return row


def list_product_name_history(
    db: Session,
    actor: Actor,
    product_definition_id: str,
) -> list[dict[str, Any]]:
    get_product_definition(db, actor, product_definition_id)
    rows = db.scalars(select(ProductNameHistory).where(
        ProductNameHistory.organization_id == actor.organization_id,
        ProductNameHistory.product_definition_id == product_definition_id,
    ).order_by(ProductNameHistory.changed_at.desc(), ProductNameHistory.id.desc())).all()
    return [product_name_history_response(row) for row in rows]


def create_product_definition(
    db: Session,
    actor: Actor,
    request: ProductDefinitionCreateRequest,
    command_id: str,
) -> dict[str, Any]:
    existing = db.scalar(select(ProductDefinition.id).where(
        ProductDefinition.organization_id == actor.organization_id,
        ProductDefinition.code == request.code,
    ))
    if existing is not None:
        raise ValueError("product code already exists in this organization")
    now = utcnow()
    row = ProductDefinition(
        organization_id=actor.organization_id,
        code=request.code,
        canonical_name=request.canonical_name,
        category=request.category,
        grade=request.grade,
        specification=request.specification,
        base_unit_code=request.base_unit_code,
        created_by_user_id=actor.user_id,
        updated_by_user_id=actor.user_id,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    try:
        db.flush()
    except IntegrityError as exc:
        raise ValueError("product code already exists in this organization") from exc
    _emit_product_event(db, actor, "ProductDefinitionCreated", row, command_id)
    return product_definition_response(row, command_id)


def update_product_definition(
    db: Session,
    actor: Actor,
    request: ProductDefinitionUpdateRequest,
    command_id: str,
) -> dict[str, Any]:
    row = _locked_definition(db, actor, request.product_definition_id)
    _assert_expected_version(row, request.expected_version)
    if row.status != "active":
        raise ValueError("archived product definition must be restored before update")
    supplied = _MUTABLE_FIELDS.intersection(request.model_fields_set)
    if not supplied:
        raise ValueError("at least one product definition field is required")
    if "canonical_name" in supplied and request.canonical_name is None:
        raise ValueError("canonical_name cannot be null")
    changes = {
        field: getattr(request, field)
        for field in supplied
        if getattr(row, field) != getattr(request, field)
    }
    if not changes:
        raise ValueError("product definition has no changes")
    previous_name = row.canonical_name
    for field, value in changes.items():
        setattr(row, field, value)
    if row.canonical_name != previous_name:
        db.add(ProductNameHistory(
            organization_id=actor.organization_id,
            product_definition_id=row.id,
            previous_name=previous_name,
            new_name=row.canonical_name,
            reason=request.reason or "Canonical name updated",
            changed_by_user_id=actor.user_id,
        ))
    _touch(row, actor)
    db.flush()
    _emit_product_event(db, actor, "ProductDefinitionUpdated", row, command_id, {"changed_fields": sorted(changes)})
    return product_definition_response(row, command_id)


def archive_product_definition(
    db: Session,
    actor: Actor,
    request: ProductDefinitionVersionRequest,
    command_id: str,
) -> dict[str, Any]:
    row = _locked_definition(db, actor, request.product_definition_id)
    _assert_expected_version(row, request.expected_version)
    if row.status != "active":
        raise ValueError("product definition is already archived")
    row.status = "archived"
    row.archived_at = utcnow()
    _touch(row, actor)
    db.flush()
    _emit_product_event(db, actor, "ProductDefinitionArchived", row, command_id)
    return product_definition_response(row, command_id)


def restore_product_definition(
    db: Session,
    actor: Actor,
    request: ProductDefinitionVersionRequest,
    command_id: str,
) -> dict[str, Any]:
    row = _locked_definition(db, actor, request.product_definition_id)
    _assert_expected_version(row, request.expected_version)
    if row.status != "archived":
        raise ValueError("product definition is not archived")
    row.status = "active"
    row.archived_at = None
    _touch(row, actor)
    db.flush()
    _emit_product_event(db, actor, "ProductDefinitionRestored", row, command_id)
    return product_definition_response(row, command_id)


def product_definition_response(row: ProductDefinition, correlation_id: str | None = None) -> dict[str, Any]:
    result = ProductDefinitionResponse.model_validate(row, from_attributes=True).model_dump(mode="json")
    if correlation_id is not None:
        result["correlation_id"] = correlation_id
    return result


def product_name_history_response(row: ProductNameHistory) -> dict[str, Any]:
    return ProductNameHistoryResponse.model_validate(row, from_attributes=True).model_dump(mode="json")


def _locked_definition(db: Session, actor: Actor, product_definition_id: str) -> ProductDefinition:
    row = db.scalar(select(ProductDefinition).where(
        ProductDefinition.id == product_definition_id,
        ProductDefinition.organization_id == actor.organization_id,
    ).with_for_update())
    if row is None:
        raise ValueError("product definition not found")
    return row


def _assert_expected_version(row: ProductDefinition, expected_version: int) -> None:
    if row.version != expected_version:
        raise ValueError(f"product definition changed; expected version {expected_version}, current version {row.version}")


def _touch(row: ProductDefinition, actor: Actor) -> None:
    row.version += 1
    row.updated_by_user_id = actor.user_id
    row.updated_at = utcnow()


def _emit_product_event(
    db: Session,
    actor: Actor,
    event_type: str,
    row: ProductDefinition,
    command_id: str,
    extra: dict[str, Any] | None = None,
) -> None:
    emit_module_event(db, actor, event_type, "ProductDefinition", row.id, {
        "correlation_id": command_id,
        "code": row.code,
        "status": row.status,
        "version": row.version,
        **(extra or {}),
    })

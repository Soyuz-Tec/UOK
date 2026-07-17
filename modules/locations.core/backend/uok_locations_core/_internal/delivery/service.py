from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from uok.kernel.security import Actor
from uok.models_base import utcnow
from uok.module_events import emit_module_event

from uok_locations_core._internal.persistence.models import LocationDefinition, LocationNameHistory

from .schemas import (
    LocationDefinitionCreateRequest,
    LocationDefinitionResponse,
    LocationDefinitionUpdateRequest,
    LocationDefinitionVersionRequest,
    LocationNameHistoryResponse,
)

_MUTABLE_FIELDS = frozenset({"canonical_name", "location_type", "country_code"})


def list_location_definitions(db: Session, actor: Actor, include_archived: bool = False) -> list[dict[str, Any]]:
    statement = select(LocationDefinition).where(LocationDefinition.organization_id == actor.organization_id)
    if not include_archived:
        statement = statement.where(LocationDefinition.status == "active")
    rows = db.scalars(statement.order_by(LocationDefinition.canonical_name, LocationDefinition.code)).all()
    return [location_definition_response(row) for row in rows]


def get_location_definition(db: Session, actor: Actor, location_definition_id: str) -> LocationDefinition:
    row = db.scalar(select(LocationDefinition).where(
        LocationDefinition.id == location_definition_id,
        LocationDefinition.organization_id == actor.organization_id,
    ))
    if row is None:
        raise ValueError("location definition not found")
    return row


def list_location_name_history(
    db: Session,
    actor: Actor,
    location_definition_id: str,
) -> list[dict[str, Any]]:
    get_location_definition(db, actor, location_definition_id)
    rows = db.scalars(select(LocationNameHistory).where(
        LocationNameHistory.organization_id == actor.organization_id,
        LocationNameHistory.location_definition_id == location_definition_id,
    ).order_by(LocationNameHistory.changed_at.desc(), LocationNameHistory.id.desc())).all()
    return [location_name_history_response(row) for row in rows]


def create_location_definition(
    db: Session,
    actor: Actor,
    request: LocationDefinitionCreateRequest,
    command_id: str,
) -> dict[str, Any]:
    existing = db.scalar(select(LocationDefinition.id).where(
        LocationDefinition.organization_id == actor.organization_id,
        LocationDefinition.code == request.code,
    ))
    if existing is not None:
        raise ValueError("location code already exists in this organization")
    now = utcnow()
    row = LocationDefinition(
        organization_id=actor.organization_id,
        code=request.code,
        canonical_name=request.canonical_name,
        location_type=request.location_type,
        country_code=request.country_code,
        created_by_user_id=actor.user_id,
        updated_by_user_id=actor.user_id,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    try:
        db.flush()
    except IntegrityError as exc:
        raise ValueError("location code already exists in this organization") from exc
    _emit_location_event(db, actor, "LocationDefinitionCreated", row, command_id)
    return location_definition_response(row, command_id)


def update_location_definition(
    db: Session,
    actor: Actor,
    request: LocationDefinitionUpdateRequest,
    command_id: str,
) -> dict[str, Any]:
    row = _locked_definition(db, actor, request.location_definition_id)
    _assert_expected_version(row, request.expected_version)
    if row.status != "active":
        raise ValueError("archived location definition must be restored before update")
    supplied = _MUTABLE_FIELDS.intersection(request.model_fields_set)
    if not supplied:
        raise ValueError("at least one location definition field is required")
    if "canonical_name" in supplied and request.canonical_name is None:
        raise ValueError("canonical_name cannot be null")
    if "location_type" in supplied and request.location_type is None:
        raise ValueError("location_type cannot be null")
    if "country_code" in supplied and request.country_code is None:
        raise ValueError("country_code cannot be null")
    changes = {
        field: getattr(request, field)
        for field in supplied
        if getattr(row, field) != getattr(request, field)
    }
    if not changes:
        raise ValueError("location definition has no changes")
    previous_name = row.canonical_name
    for field, value in changes.items():
        setattr(row, field, value)
    if row.canonical_name != previous_name:
        db.add(LocationNameHistory(
            organization_id=actor.organization_id,
            location_definition_id=row.id,
            previous_name=previous_name,
            new_name=row.canonical_name,
            reason=request.reason or "Canonical name updated",
            changed_by_user_id=actor.user_id,
        ))
    _touch(row, actor)
    db.flush()
    _emit_location_event(db, actor, "LocationDefinitionUpdated", row, command_id, {"changed_fields": sorted(changes)})
    return location_definition_response(row, command_id)


def archive_location_definition(
    db: Session,
    actor: Actor,
    request: LocationDefinitionVersionRequest,
    command_id: str,
) -> dict[str, Any]:
    row = _locked_definition(db, actor, request.location_definition_id)
    _assert_expected_version(row, request.expected_version)
    if row.status != "active":
        raise ValueError("location definition is already archived")
    row.status = "archived"
    row.archived_at = utcnow()
    _touch(row, actor)
    db.flush()
    _emit_location_event(db, actor, "LocationDefinitionArchived", row, command_id)
    return location_definition_response(row, command_id)


def restore_location_definition(
    db: Session,
    actor: Actor,
    request: LocationDefinitionVersionRequest,
    command_id: str,
) -> dict[str, Any]:
    row = _locked_definition(db, actor, request.location_definition_id)
    _assert_expected_version(row, request.expected_version)
    if row.status != "archived":
        raise ValueError("location definition is not archived")
    row.status = "active"
    row.archived_at = None
    _touch(row, actor)
    db.flush()
    _emit_location_event(db, actor, "LocationDefinitionRestored", row, command_id)
    return location_definition_response(row, command_id)


def location_definition_response(row: LocationDefinition, correlation_id: str | None = None) -> dict[str, Any]:
    result = LocationDefinitionResponse.model_validate(row, from_attributes=True).model_dump(mode="json")
    if correlation_id is not None:
        result["correlation_id"] = correlation_id
    return result


def location_name_history_response(row: LocationNameHistory) -> dict[str, Any]:
    return LocationNameHistoryResponse.model_validate(row, from_attributes=True).model_dump(mode="json")


def _locked_definition(db: Session, actor: Actor, location_definition_id: str) -> LocationDefinition:
    row = db.scalar(select(LocationDefinition).where(
        LocationDefinition.id == location_definition_id,
        LocationDefinition.organization_id == actor.organization_id,
    ).with_for_update())
    if row is None:
        raise ValueError("location definition not found")
    return row


def _assert_expected_version(row: LocationDefinition, expected_version: int) -> None:
    if row.version != expected_version:
        raise ValueError(f"location definition changed; expected version {expected_version}, current version {row.version}")


def _touch(row: LocationDefinition, actor: Actor) -> None:
    row.version += 1
    row.updated_by_user_id = actor.user_id
    row.updated_at = utcnow()


def _emit_location_event(
    db: Session,
    actor: Actor,
    event_type: str,
    row: LocationDefinition,
    command_id: str,
    extra: dict[str, Any] | None = None,
) -> None:
    emit_module_event(db, actor, event_type, "LocationDefinition", row.id, {
        "correlation_id": command_id,
        "code": row.code,
        "status": row.status,
        "version": row.version,
        **(extra or {}),
    })

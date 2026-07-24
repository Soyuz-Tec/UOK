from __future__ import annotations

from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from uok.kernel.security import Actor
from uok.models_base import utcnow
from uok.module_events import emit_module_event

from uok_routes_core._internal.persistence.models import RouteDefinition, RouteNameHistory, RouteStop

from .location_gateway import require_active_path_locations
from .read_service import route_definition_response, route_location_ids
from .schemas import RouteDefinitionCreateRequest, RouteDefinitionUpdateRequest, RouteDefinitionVersionRequest

_PATH_FIELDS = frozenset({"origin_location_id", "destination_location_id", "waypoint_location_ids"})


def create_route_definition(
    db: Session,
    actor: Actor,
    request: RouteDefinitionCreateRequest,
    command_id: str,
) -> dict[str, Any]:
    if db.scalar(select(RouteDefinition.id).where(
        RouteDefinition.organization_id == actor.organization_id,
        RouteDefinition.code == request.code,
    )) is not None:
        raise ValueError("route code already exists in this organization")
    ordered_ids = _create_path(request)
    require_active_path_locations(db, actor, ordered_ids)
    now = utcnow()
    row = RouteDefinition(
        organization_id=actor.organization_id,
        code=request.code,
        canonical_name=request.canonical_name,
        mode_hint=request.mode_hint,
        created_by_user_id=actor.user_id,
        updated_by_user_id=actor.user_id,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    try:
        db.flush()
    except IntegrityError as exc:
        raise ValueError("route code already exists in this organization") from exc
    _replace_route_stops(db, actor, row.id, ordered_ids)
    db.flush()
    _emit_route_event(db, actor, "RouteDefinitionCreated", row, command_id, ordered_ids)
    return route_definition_response(db, actor, row, command_id)


def update_route_definition(
    db: Session,
    actor: Actor,
    request: RouteDefinitionUpdateRequest,
    command_id: str,
) -> dict[str, Any]:
    row = _locked_definition(db, actor, request.route_definition_id)
    _assert_expected_version(row, request.expected_version)
    if row.status != "active":
        raise ValueError("archived route definition must be restored before update")
    supplied = request.model_fields_set
    if not ({"canonical_name", "mode_hint"} | _PATH_FIELDS).intersection(supplied):
        raise ValueError("at least one route definition field is required")
    changes: list[str] = []
    if "canonical_name" in supplied:
        if request.canonical_name is None:
            raise ValueError("canonical_name cannot be null")
        if row.canonical_name != request.canonical_name:
            previous_name = row.canonical_name
            row.canonical_name = request.canonical_name
            db.add(RouteNameHistory(
                organization_id=actor.organization_id,
                route_definition_id=row.id,
                previous_name=previous_name,
                new_name=row.canonical_name,
                reason=request.reason or "Canonical name updated",
                changed_by_user_id=actor.user_id,
            ))
            changes.append("canonical_name")
    if "mode_hint" in supplied and row.mode_hint != request.mode_hint:
        row.mode_hint = request.mode_hint
        changes.append("mode_hint")

    ordered_ids = route_location_ids(db, actor, row.id)
    if _PATH_FIELDS.issubset(supplied):
        updated_ids = _update_path(request)
        require_active_path_locations(db, actor, updated_ids)
        if updated_ids != ordered_ids:
            _replace_route_stops(db, actor, row.id, updated_ids)
            ordered_ids = updated_ids
            changes.append("path")
    if not changes:
        raise ValueError("route definition has no changes")
    _touch(row, actor)
    db.flush()
    _emit_route_event(
        db,
        actor,
        "RouteDefinitionUpdated",
        row,
        command_id,
        ordered_ids,
        {"changed_fields": sorted(changes)},
    )
    return route_definition_response(db, actor, row, command_id)


def archive_route_definition(
    db: Session,
    actor: Actor,
    request: RouteDefinitionVersionRequest,
    command_id: str,
) -> dict[str, Any]:
    row = _locked_definition(db, actor, request.route_definition_id)
    _assert_expected_version(row, request.expected_version)
    if row.status != "active":
        raise ValueError("route definition is already archived")
    row.status = "archived"
    row.archived_at = utcnow()
    _touch(row, actor)
    db.flush()
    ordered_ids = route_location_ids(db, actor, row.id)
    _emit_route_event(db, actor, "RouteDefinitionArchived", row, command_id, ordered_ids)
    return route_definition_response(db, actor, row, command_id)


def restore_route_definition(
    db: Session,
    actor: Actor,
    request: RouteDefinitionVersionRequest,
    command_id: str,
) -> dict[str, Any]:
    row = _locked_definition(db, actor, request.route_definition_id)
    _assert_expected_version(row, request.expected_version)
    if row.status != "archived":
        raise ValueError("route definition is not archived")
    row.status = "active"
    row.archived_at = None
    _touch(row, actor)
    db.flush()
    ordered_ids = route_location_ids(db, actor, row.id)
    _emit_route_event(db, actor, "RouteDefinitionRestored", row, command_id, ordered_ids)
    return route_definition_response(db, actor, row, command_id)


def _create_path(request: RouteDefinitionCreateRequest) -> list[str]:
    return [request.origin_location_id, *request.waypoint_location_ids, request.destination_location_id]


def _update_path(request: RouteDefinitionUpdateRequest) -> list[str]:
    assert request.origin_location_id is not None
    assert request.destination_location_id is not None
    assert request.waypoint_location_ids is not None
    return [request.origin_location_id, *request.waypoint_location_ids, request.destination_location_id]


def _replace_route_stops(db: Session, actor: Actor, route_definition_id: str, ordered_ids: list[str]) -> None:
    db.execute(delete(RouteStop).where(
        RouteStop.organization_id == actor.organization_id,
        RouteStop.route_definition_id == route_definition_id,
    ))
    last_sequence = len(ordered_ids) - 1
    for sequence, location_id in enumerate(ordered_ids):
        role = "origin" if sequence == 0 else "destination" if sequence == last_sequence else "waypoint"
        db.add(RouteStop(
            organization_id=actor.organization_id,
            route_definition_id=route_definition_id,
            sequence=sequence,
            stop_role=role,
            location_definition_id=location_id,
        ))


def _locked_definition(db: Session, actor: Actor, route_definition_id: str) -> RouteDefinition:
    row = db.scalar(select(RouteDefinition).where(
        RouteDefinition.id == route_definition_id,
        RouteDefinition.organization_id == actor.organization_id,
    ).with_for_update())
    if row is None:
        raise ValueError("route definition not found")
    return row


def _assert_expected_version(row: RouteDefinition, expected_version: int) -> None:
    if row.version != expected_version:
        raise ValueError(f"route definition changed; expected version {expected_version}, current version {row.version}")


def _touch(row: RouteDefinition, actor: Actor) -> None:
    row.version += 1
    row.updated_by_user_id = actor.user_id
    row.updated_at = utcnow()


def _emit_route_event(
    db: Session,
    actor: Actor,
    event_type: str,
    row: RouteDefinition,
    command_id: str,
    ordered_ids: list[str],
    extra: dict[str, Any] | None = None,
) -> None:
    emit_module_event(db, actor, event_type, "RouteDefinition", row.id, {
        "correlation_id": command_id,
        "code": row.code,
        "status": row.status,
        "version": row.version,
        "ordered_location_ids": ordered_ids,
        **(extra or {}),
    })


__all__ = [
    "archive_route_definition",
    "create_route_definition",
    "restore_route_definition",
    "update_route_definition",
]

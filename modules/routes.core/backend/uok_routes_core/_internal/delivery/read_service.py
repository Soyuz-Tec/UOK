from __future__ import annotations

from collections import defaultdict
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok.kernel.security import Actor

from uok_routes_core._internal.persistence.models import RouteDefinition, RouteNameHistory, RouteStop

from .location_gateway import location_resolution_response, resolve_path_locations
from .schemas import RouteDefinitionResponse, RouteNameHistoryResponse, RouteStopResponse


def list_route_definitions(db: Session, actor: Actor, include_archived: bool = False) -> list[dict[str, Any]]:
    statement = select(RouteDefinition).where(RouteDefinition.organization_id == actor.organization_id)
    if not include_archived:
        statement = statement.where(RouteDefinition.status == "active")
    rows = db.scalars(statement.order_by(RouteDefinition.canonical_name, RouteDefinition.code)).all()
    return _route_definition_responses(db, actor, rows)


def get_route_definition(db: Session, actor: Actor, route_definition_id: str) -> RouteDefinition:
    row = db.scalar(select(RouteDefinition).where(
        RouteDefinition.id == route_definition_id,
        RouteDefinition.organization_id == actor.organization_id,
    ))
    if row is None:
        raise ValueError("route definition not found")
    return row


def list_route_name_history(
    db: Session,
    actor: Actor,
    route_definition_id: str,
) -> list[dict[str, Any]]:
    get_route_definition(db, actor, route_definition_id)
    rows = db.scalars(select(RouteNameHistory).where(
        RouteNameHistory.organization_id == actor.organization_id,
        RouteNameHistory.route_definition_id == route_definition_id,
    ).order_by(RouteNameHistory.changed_at.desc(), RouteNameHistory.id.desc())).all()
    return [route_name_history_response(row) for row in rows]


def route_definition_response(
    db: Session,
    actor: Actor,
    row: RouteDefinition,
    correlation_id: str | None = None,
) -> dict[str, Any]:
    result = _route_definition_responses(db, actor, [row])[0]
    if correlation_id is not None:
        result["correlation_id"] = correlation_id
    return result


def route_name_history_response(row: RouteNameHistory) -> dict[str, Any]:
    return RouteNameHistoryResponse.model_validate(row, from_attributes=True).model_dump(mode="json")


def route_location_ids(db: Session, actor: Actor, route_definition_id: str) -> list[str]:
    rows = db.scalars(select(RouteStop.location_definition_id).where(
        RouteStop.organization_id == actor.organization_id,
        RouteStop.route_definition_id == route_definition_id,
    ).order_by(RouteStop.sequence)).all()
    return list(rows)


def _route_definition_responses(
    db: Session,
    actor: Actor,
    rows: list[RouteDefinition],
) -> list[dict[str, Any]]:
    if not rows:
        return []
    route_ids = [row.id for row in rows]
    stops = db.scalars(select(RouteStop).where(
        RouteStop.organization_id == actor.organization_id,
        RouteStop.route_definition_id.in_(route_ids),
    ).order_by(RouteStop.route_definition_id, RouteStop.sequence)).all()
    by_route: dict[str, list[RouteStop]] = defaultdict(list)
    for stop in stops:
        by_route[stop.route_definition_id].append(stop)
    location_ids = list(dict.fromkeys(stop.location_definition_id for stop in stops))
    resolutions = resolve_path_locations(db, actor, location_ids)
    by_location = {resolution.location_definition_id: resolution for resolution in resolutions}
    return [_serialize_route(row, by_route[row.id], by_location) for row in rows]


def _serialize_route(
    row: RouteDefinition,
    stops: list[RouteStop],
    by_location: dict[str, Any],
) -> dict[str, Any]:
    stop_values = tuple(
        RouteStopResponse(
            sequence=stop.sequence,
            stop_role=stop.stop_role,
            location=location_resolution_response(by_location[stop.location_definition_id]),
        )
        for stop in stops
    )
    response = RouteDefinitionResponse(
        id=row.id,
        code=row.code,
        canonical_name=row.canonical_name,
        mode_hint=row.mode_hint,
        status=row.status,
        version=row.version,
        created_by_user_id=row.created_by_user_id,
        updated_by_user_id=row.updated_by_user_id,
        created_at=row.created_at,
        updated_at=row.updated_at,
        archived_at=row.archived_at,
        stops=stop_values,
    )
    return response.model_dump(mode="json")


__all__ = [
    "get_route_definition",
    "list_route_definitions",
    "list_route_name_history",
    "route_definition_response",
    "route_location_ids",
]

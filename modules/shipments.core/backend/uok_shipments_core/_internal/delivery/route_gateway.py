from __future__ import annotations

from sqlalchemy.orm import Session

from uok.kernel.security import Actor
from uok_routes_core.public_api import RoutePathReferenceDTO, resolve_route_path_references

from .schemas import RoutePathReferenceResponse


def resolve_route(
    db: Session,
    actor: Actor,
    route_definition_id: str,
) -> RoutePathReferenceDTO:
    return resolve_route_path_references(db, actor, [route_definition_id])[0]


def require_matching_active_route(
    db: Session,
    actor: Actor,
    route_definition_id: str,
    origin_location_id: str,
    destination_location_id: str,
) -> RoutePathReferenceDTO:
    resolution = resolve_route(db, actor, route_definition_id)
    if resolution.status != "ready":
        raise ValueError(
            "shipment Route must be active and visible "
            f"({route_definition_id}:{resolution.status})"
        )
    if (
        len(resolution.ordered_location_ids) < 2
        or resolution.ordered_location_ids[0] != origin_location_id
        or resolution.ordered_location_ids[-1] != destination_location_id
    ):
        raise ValueError("shipment Route endpoints must match origin and destination Locations")
    return resolution


def active_route_options(db: Session, actor: Actor) -> list[dict[str, object]]:
    return [route_resolution_response(value) for value in resolve_route_path_references(db, actor)]


def route_resolution_response(value: RoutePathReferenceDTO) -> dict[str, object]:
    return RoutePathReferenceResponse.model_validate(value, from_attributes=True).model_dump(mode="json")


__all__ = [
    "active_route_options",
    "require_matching_active_route",
    "resolve_route",
    "route_resolution_response",
]

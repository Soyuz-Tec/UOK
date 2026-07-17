from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy.orm import Session

from uok.kernel.security import Actor
from uok_locations_core.public_api import LocationReferenceResolution, resolve_location_references

from .schemas import LocationReferenceResponse


def resolve_locations(
    db: Session,
    actor: Actor,
    location_ids: Iterable[str],
) -> tuple[LocationReferenceResolution, ...]:
    return resolve_location_references(db, actor, location_ids)


def require_active_locations(
    db: Session,
    actor: Actor,
    location_ids: tuple[str, ...],
) -> tuple[LocationReferenceResolution, ...]:
    resolutions = resolve_locations(db, actor, location_ids)
    invalid = [resolution for resolution in resolutions if resolution.status != "ready"]
    if invalid:
        states = ", ".join(
            f"{resolution.location_definition_id}:{resolution.status}" for resolution in invalid
        )
        raise ValueError(f"shipment Locations must be active and visible ({states})")
    return resolutions


def active_location_options(db: Session, actor: Actor) -> list[dict[str, object]]:
    return [location_resolution_response(value) for value in resolve_location_references(db, actor)]


def location_resolution_response(value: LocationReferenceResolution) -> dict[str, object]:
    return LocationReferenceResponse.model_validate(value, from_attributes=True).model_dump(mode="json")


__all__ = [
    "active_location_options",
    "location_resolution_response",
    "require_active_locations",
    "resolve_locations",
]

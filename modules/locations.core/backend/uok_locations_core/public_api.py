"""Supported Location Master runtime-composition facade."""

from __future__ import annotations

from collections.abc import Iterable as _Iterable
from dataclasses import dataclass as _dataclass
from importlib import import_module as _import_module
from typing import Any as _Any
from typing import Literal as _Literal

from sqlalchemy.orm import Session as _Session

from uok.kernel.security import Actor as _Actor

_ReferenceStatus = _Literal["ready", "unavailable", "denied", "missing"]

_EXPORTS = {
    "api_router": ("uok_locations_core._internal.delivery.api", "router"),
}

api_router: _Any


@_dataclass(frozen=True)
class LocationReferenceResolution:
    location_definition_id: str
    status: _ReferenceStatus
    code: str | None
    canonical_name: str | None
    location_type: str | None
    country_code: str | None
    status_summary: str


def resolve_location_references(
    db: _Session,
    actor: _Actor,
    location_definition_ids: _Iterable[str] | None = None,
) -> tuple[LocationReferenceResolution, ...]:
    """Resolve tenant-visible Location value data without exposing owner ORM state."""
    from sqlalchemy import select as _select

    from uok.kernel.module_runtime import OPERATIONAL_STATUSES, module_record_status
    from uok.kernel.security import has_permission as _has_permission
    from uok_locations_core._internal.persistence.models import LocationDefinition as _LocationDefinition

    requested = None if location_definition_ids is None else tuple(str(value).strip() for value in location_definition_ids)
    if not _has_permission(actor, "locations.read"):
        if requested is None:
            raise PermissionError("locations.read")
        return tuple(_unresolved_location(value, "denied") for value in requested)
    if module_record_status(db, actor.organization_id, "locations.core") not in OPERATIONAL_STATUSES:
        if requested is None:
            raise ValueError("locations.core is not operational")
        return tuple(_unresolved_location(value, "unavailable") for value in requested)

    statement = _select(_LocationDefinition).where(
        _LocationDefinition.organization_id == actor.organization_id,
    )
    if requested is None:
        rows = db.scalars(
            statement.where(_LocationDefinition.status == "active").order_by(
                _LocationDefinition.canonical_name,
                _LocationDefinition.code,
            )
        ).all()
        return tuple(_location_reference(row) for row in rows)
    if not requested:
        return ()
    rows = db.scalars(statement.where(_LocationDefinition.id.in_(set(requested)))).all()
    by_id = {row.id: row for row in rows}
    return tuple(
        _location_reference(by_id[value]) if value in by_id else _unresolved_location(value, "missing")
        for value in requested
    )


def _location_reference(row: _Any) -> LocationReferenceResolution:
    status: _ReferenceStatus = "ready" if row.status == "active" else "unavailable"
    return LocationReferenceResolution(
        row.id,
        status,
        row.code,
        row.canonical_name,
        row.location_type,
        row.country_code,
        f"Location is {row.status}.",
    )


def _unresolved_location(location_definition_id: str, status: _ReferenceStatus) -> LocationReferenceResolution:
    summaries = {
        "denied": "The Location target is not visible to this actor.",
        "missing": "The Location target does not exist in this organization.",
        "unavailable": "The Location provider is unavailable.",
    }
    return LocationReferenceResolution(location_definition_id, status, None, None, None, None, summaries[status])


def command_handlers() -> dict[str, _Any]:
    from uok_locations_core._internal.delivery.commands import command_handlers as _provider

    return _provider()


def command_permissions() -> dict[str, str]:
    from uok_locations_core._internal.delivery.commands import command_permissions as _provider

    return _provider()


def role_grants() -> dict[str, set[str]]:
    from uok_locations_core._internal.delivery.policy import role_grants as _provider

    return _provider()


def __getattr__(name: str) -> _Any:
    try:
        module_name, symbol_name = _EXPORTS[name]
    except KeyError as exc:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}") from exc
    value = getattr(_import_module(module_name), symbol_name)
    globals()[name] = value
    return value


def __dir__() -> list[str]:
    return sorted(set(globals()) | set(__all__))


__all__ = [
    "LocationReferenceResolution",
    "api_router",
    "command_handlers",
    "command_permissions",
    "resolve_location_references",
    "role_grants",
]

del annotations

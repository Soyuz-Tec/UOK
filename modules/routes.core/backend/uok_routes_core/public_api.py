"""Supported Route/Corridor facade; ORM mappings remain private."""

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
    "api_router": ("uok_routes_core._internal.delivery.api", "router"),
}

api_router: _Any


@_dataclass(frozen=True)
class RouteReferenceDTO:
    route_definition_id: str
    status: _ReferenceStatus
    code: str | None
    canonical_name: str | None
    mode_hint: str | None
    status_summary: str


@_dataclass(frozen=True)
class RoutePathReferenceDTO:
    route_definition_id: str
    status: _ReferenceStatus
    code: str | None
    canonical_name: str | None
    mode_hint: str | None
    ordered_location_ids: tuple[str, ...]
    status_summary: str


def resolve_route_reference(db: _Session, actor: _Actor, route_definition_id: str) -> RouteReferenceDTO:
    """Resolve stable Route identity without exposing the Route ORM mapping."""
    from sqlalchemy import select as _select

    from uok.kernel.module_runtime import OPERATIONAL_STATUSES, module_record_status
    from uok.kernel.security import has_permission as _has_permission
    from uok_routes_core._internal.persistence.models import RouteDefinition as _RouteDefinition

    if not _has_permission(actor, "routes.read"):
        return _unresolved_route(route_definition_id, "denied")
    if module_record_status(db, actor.organization_id, "routes.core") not in OPERATIONAL_STATUSES:
        return _unresolved_route(route_definition_id, "unavailable")
    row = db.scalar(_select(_RouteDefinition).where(
        _RouteDefinition.id == route_definition_id,
        _RouteDefinition.organization_id == actor.organization_id,
    ))
    if row is None:
        return _unresolved_route(route_definition_id, "missing")
    status: _ReferenceStatus = "ready" if row.status == "active" else "unavailable"
    return RouteReferenceDTO(
        row.id,
        status,
        row.code,
        row.canonical_name,
        row.mode_hint,
        f"Route is {row.status}.",
    )


def resolve_route_path_references(
    db: _Session,
    actor: _Actor,
    route_definition_ids: _Iterable[str] | None = None,
) -> tuple[RoutePathReferenceDTO, ...]:
    """Resolve tenant-visible Route paths without exposing Route or Stop ORM state."""
    from collections import defaultdict as _defaultdict

    from sqlalchemy import select as _select

    from uok.kernel.module_runtime import OPERATIONAL_STATUSES, module_record_status
    from uok.kernel.security import has_permission as _has_permission
    from uok_routes_core._internal.persistence.models import RouteDefinition as _RouteDefinition
    from uok_routes_core._internal.persistence.models import RouteStop as _RouteStop

    requested = None if route_definition_ids is None else tuple(str(value).strip() for value in route_definition_ids)
    if not _has_permission(actor, "routes.read"):
        if requested is None:
            raise PermissionError("routes.read")
        return tuple(_unresolved_route_path(value, "denied") for value in requested)
    if module_record_status(db, actor.organization_id, "routes.core") not in OPERATIONAL_STATUSES:
        if requested is None:
            raise ValueError("routes.core is not operational")
        return tuple(_unresolved_route_path(value, "unavailable") for value in requested)

    statement = _select(_RouteDefinition).where(
        _RouteDefinition.organization_id == actor.organization_id,
    )
    if requested is None:
        rows = db.scalars(
            statement.where(_RouteDefinition.status == "active").order_by(
                _RouteDefinition.canonical_name,
                _RouteDefinition.code,
            )
        ).all()
    elif not requested:
        return ()
    else:
        rows = db.scalars(statement.where(_RouteDefinition.id.in_(set(requested)))).all()
    route_ids = [row.id for row in rows]
    stops = db.execute(
        _select(_RouteStop.route_definition_id, _RouteStop.location_definition_id).where(
            _RouteStop.organization_id == actor.organization_id,
            _RouteStop.route_definition_id.in_(route_ids),
        ).order_by(_RouteStop.route_definition_id, _RouteStop.sequence)
    ).all() if route_ids else []
    by_route: dict[str, list[str]] = _defaultdict(list)
    for route_id, location_id in stops:
        by_route[route_id].append(location_id)
    by_id = {
        row.id: _route_path_reference(row, tuple(by_route[row.id]))
        for row in rows
    }
    if requested is None:
        return tuple(by_id[row.id] for row in rows)
    return tuple(
        by_id[value] if value in by_id else _unresolved_route_path(value, "missing")
        for value in requested
    )


def _route_path_reference(row: _Any, ordered_location_ids: tuple[str, ...]) -> RoutePathReferenceDTO:
    status: _ReferenceStatus = "ready" if row.status == "active" else "unavailable"
    return RoutePathReferenceDTO(
        row.id,
        status,
        row.code,
        row.canonical_name,
        row.mode_hint,
        ordered_location_ids,
        f"Route is {row.status}.",
    )


def _unresolved_route_path(route_definition_id: str, status: _ReferenceStatus) -> RoutePathReferenceDTO:
    summaries = {
        "denied": "The Route target is not visible to this actor.",
        "missing": "The Route target does not exist in this organization.",
        "unavailable": "The Route provider is unavailable.",
    }
    return RoutePathReferenceDTO(route_definition_id, status, None, None, None, (), summaries[status])


def _unresolved_route(route_definition_id: str, status: _ReferenceStatus) -> RouteReferenceDTO:
    summaries = {
        "denied": "The Route target is not visible to this actor.",
        "missing": "The Route target does not exist in this organization.",
        "unavailable": "The Route provider is unavailable.",
    }
    return RouteReferenceDTO(route_definition_id, status, None, None, None, summaries[status])


def command_handlers() -> dict[str, _Any]:
    from uok_routes_core._internal.delivery.commands import command_handlers as _provider

    return _provider()


def command_permissions() -> dict[str, str]:
    from uok_routes_core._internal.delivery.commands import command_permissions as _provider

    return _provider()


def role_grants() -> dict[str, set[str]]:
    from uok_routes_core._internal.delivery.policy import role_grants as _provider

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
    "RoutePathReferenceDTO",
    "RouteReferenceDTO",
    "api_router",
    "command_handlers",
    "command_permissions",
    "resolve_route_path_references",
    "resolve_route_reference",
    "role_grants",
]

del annotations

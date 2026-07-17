"""Supported Route/Corridor facade; ORM mappings remain private."""

from __future__ import annotations

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
    "RouteReferenceDTO",
    "api_router",
    "command_handlers",
    "command_permissions",
    "resolve_route_reference",
    "role_grants",
]

del annotations

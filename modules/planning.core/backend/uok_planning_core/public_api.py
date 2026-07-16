"""Supported Planning boundary for runtime composition.

Planning ORM mappings and implementation helpers remain under ``_internal``.
"""

from __future__ import annotations

from importlib import import_module as _import_module
from typing import Any as _Any

from sqlalchemy.orm import Session as _Session

from uok.security import Actor as _Actor


_EXPORTS = {
    "api_router": ("uok_planning_core._internal.delivery.api", "router"),
}

# Runtime composition needs the concrete APIRouter, but importing it while the
# command registry is initializing would create a cycle. The annotation keeps
# the manifest contract statically discoverable; module ``__getattr__`` loads
# the object only when the router composer asks for it.
api_router: _Any


def command_handlers() -> dict[str, _Any]:
    from uok_planning_core._internal.delivery.commands import command_handlers as provider

    return provider()


def command_permissions() -> dict[str, str]:
    from uok_planning_core._internal.delivery.commands import command_permissions as provider

    return provider()


def role_grants() -> dict[str, set[str]]:
    from uok_planning_core._internal.delivery.policy import role_grants as provider

    return provider()


def dashboard_counts(db: _Session, actor: _Actor) -> dict[str, int]:
    from uok_planning_core._internal.portfolio_audit.reports import dashboard_counts as provider

    return provider(db, actor)


def evidence(db: _Session, organization_id: str) -> dict[str, _Any]:
    from uok_planning_core._internal.portfolio_audit.reports import evidence as provider

    return provider(db, organization_id)


def assert_planning_replay_visible(
    db: _Session,
    actor: _Actor,
    command_type: str,
    payload: dict[str, _Any],
    result: dict[str, _Any],
    correlation_id: str,
) -> None:
    from uok_planning_core._internal.portfolio_audit.replay_visibility import (
        assert_planning_replay_visible as guard,
    )

    guard(db, actor, command_type, payload, result, correlation_id)


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
    "api_router",
    "assert_planning_replay_visible",
    "command_handlers",
    "command_permissions",
    "dashboard_counts",
    "evidence",
    "role_grants",
]

del annotations

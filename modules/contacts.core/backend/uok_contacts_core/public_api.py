"""Supported Contacts boundary for runtime composition and Party DTO queries.

Contacts ORM mappings and implementation helpers remain under ``_internal``.
"""

from __future__ import annotations

from dataclasses import dataclass as _dataclass
from importlib import import_module as _import_module
from typing import Any as _Any
from typing import Literal as _Literal

from sqlalchemy.orm import Session as _Session

from uok.security import Actor as _Actor

_ReferenceStatus = _Literal["ready", "unavailable", "denied", "missing"]

_EXPORTS = {
    "api_router": ("uok_contacts_core._internal.delivery.api", "router"),
}

api_router: _Any


@_dataclass(frozen=True)
class PartyReferenceResolution:
    status: _ReferenceStatus
    display_label: str | None
    status_summary: str
    open_path: str | None = None


def resolve_party_reference(db: _Session, actor: _Actor, party_id: str) -> PartyReferenceResolution:
    """Resolve a Party reference without exposing the Contacts ORM mapping."""
    from sqlalchemy import select as _select

    from uok_contacts_core._internal.persistence.models import Party as _Party
    from uok_contacts_core._internal.registry.access import can_read_party as _can_read_party
    from uok.security import has_permission as _has_permission

    if not _has_permission(actor, "contacts.read"):
        return PartyReferenceResolution("denied", None, "The linked target is not visible to this actor.")
    row = db.scalar(_select(_Party).where(
        _Party.id == party_id,
        _Party.organization_id == actor.organization_id,
    ))
    if row is None:
        return PartyReferenceResolution("missing", None, "The party target does not exist in this organization.")
    if not _can_read_party(actor, row):
        return PartyReferenceResolution("denied", None, "The linked target is not visible to this actor.")
    if row.purged_at is not None or row.status != "active":
        return PartyReferenceResolution("unavailable", row.display_name, f"Party is {row.status}.")
    return PartyReferenceResolution(
        "ready",
        row.display_name,
        f"Party is {row.status}.",
        f"/?view=contacts&party_id={row.id}",
    )


def command_handlers() -> dict[str, _Any]:
    from uok_contacts_core._internal.delivery.commands import command_handlers as provider

    return provider()


def command_permissions() -> dict[str, str]:
    from uok_contacts_core._internal.delivery.commands import command_permissions as provider

    return provider()


def role_grants() -> dict[str, set[str]]:
    from uok_contacts_core._internal.delivery.policy import role_grants as provider

    return provider()


def dashboard_counts(db: _Session, actor: _Actor) -> dict[str, int]:
    from uok_contacts_core._internal.delivery.reports import dashboard_counts as provider

    return provider(db, actor)


def evidence(db: _Session, organization_id: str) -> dict[str, _Any]:
    from uok_contacts_core._internal.delivery.reports import evidence as provider

    return provider(db, organization_id)


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
    "PartyReferenceResolution",
    "api_router",
    "command_handlers",
    "command_permissions",
    "dashboard_counts",
    "evidence",
    "resolve_party_reference",
    "role_grants",
]

del annotations

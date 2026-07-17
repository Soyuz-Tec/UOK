"""Supported Shipment Support facade; owner ORM mappings remain private."""

from __future__ import annotations

from dataclasses import dataclass as _dataclass
from importlib import import_module as _import_module
from typing import Any as _Any
from typing import Literal as _Literal

from sqlalchemy.orm import Session as _Session

from uok.kernel.security import Actor as _Actor

_ReferenceStatus = _Literal["ready", "unavailable", "denied", "missing"]

_EXPORTS = {
    "api_router": ("uok_shipments_core._internal.delivery.api", "router"),
}

api_router: _Any


@_dataclass(frozen=True)
class ShipmentReferenceDTO:
    shipment_id: str
    status: _ReferenceStatus
    code: str | None
    lifecycle_status: str | None
    display_label: str | None
    status_summary: str
    open_path: str | None = None


def resolve_shipment_reference(
    db: _Session,
    actor: _Actor,
    shipment_id: str,
) -> ShipmentReferenceDTO:
    """Resolve stable Shipment identity without exposing owner ORM state."""
    from sqlalchemy import select as _select

    from uok.kernel.module_runtime import OPERATIONAL_STATUSES, module_record_status
    from uok.kernel.security import has_permission as _has_permission
    from uok_shipments_core._internal.persistence.models import Shipment as _Shipment

    if not _has_permission(actor, "shipments.read"):
        return _unresolved_shipment(shipment_id, "denied")
    if module_record_status(db, actor.organization_id, "shipments.core") not in OPERATIONAL_STATUSES:
        return _unresolved_shipment(shipment_id, "unavailable")
    row = db.scalar(_select(_Shipment).where(
        _Shipment.id == shipment_id,
        _Shipment.organization_id == actor.organization_id,
    ))
    if row is None:
        return _unresolved_shipment(shipment_id, "missing")
    return ShipmentReferenceDTO(
        row.id,
        "ready",
        row.code,
        row.status,
        row.code,
        f"Shipment is {row.status}.",
        f"/?view=shipments&shipment_id={row.id}",
    )


def _unresolved_shipment(shipment_id: str, status: _ReferenceStatus) -> ShipmentReferenceDTO:
    summaries = {
        "denied": "The Shipment target is not visible to this actor.",
        "missing": "The Shipment target does not exist in this organization.",
        "unavailable": "The Shipment provider is unavailable.",
    }
    return ShipmentReferenceDTO(shipment_id, status, None, None, None, summaries[status])


def command_handlers() -> dict[str, _Any]:
    from uok_shipments_core._internal.delivery.commands import command_handlers as _provider

    return _provider()


def command_permissions() -> dict[str, str]:
    from uok_shipments_core._internal.delivery.commands import command_permissions as _provider

    return _provider()


def role_grants() -> dict[str, set[str]]:
    from uok_shipments_core._internal.delivery.policy import role_grants as _provider

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
    "ShipmentReferenceDTO",
    "api_router",
    "command_handlers",
    "command_permissions",
    "resolve_shipment_reference",
    "role_grants",
]

del annotations

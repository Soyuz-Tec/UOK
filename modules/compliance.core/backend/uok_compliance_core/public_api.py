"""Supported Compliance Document Type facade; owner ORM state remains private."""

from __future__ import annotations

from collections.abc import Iterable as _Iterable
from dataclasses import dataclass as _dataclass
from importlib import import_module as _import_module
from typing import Any as _Any, Literal as _Literal

from sqlalchemy.orm import Session as _Session

from uok.kernel.security import Actor as _Actor

_ReferenceStatus = _Literal["ready", "unavailable", "denied", "missing"]

_EXPORTS = {"api_router": ("uok_compliance_core._internal.delivery.api", "router")}

api_router: _Any


@_dataclass(frozen=True)
class ComplianceDocumentTypeReferenceDTO:
    compliance_document_type_id: str
    status: _ReferenceStatus
    code: str | None
    canonical_name: str | None
    category: str | None
    lifecycle_status: str | None
    status_summary: str


def resolve_compliance_document_type_references(
    db: _Session,
    actor: _Actor,
    compliance_document_type_ids: _Iterable[str] | None = None,
) -> tuple[ComplianceDocumentTypeReferenceDTO, ...]:
    """Resolve tenant-visible Compliance value data without exposing owner ORM."""
    from sqlalchemy import select as _select

    from uok_compliance_core._internal.persistence.models import (
        ComplianceDocumentType as _ComplianceDocumentType,
    )

    requested = _requested_identifiers(compliance_document_type_ids)
    access_failure = _reference_access_failure(db, actor, requested)
    if access_failure is not None:
        return access_failure
    statement = _select(_ComplianceDocumentType).where(
        _ComplianceDocumentType.organization_id == actor.organization_id
    )
    if requested is None:
        rows = db.scalars(
            statement.where(_ComplianceDocumentType.status == "active").order_by(
                _ComplianceDocumentType.canonical_name,
                _ComplianceDocumentType.code,
            )
        ).all()
        return tuple(_document_type_reference(row) for row in rows)
    if not requested:
        return ()
    rows = db.scalars(statement.where(
        _ComplianceDocumentType.id.in_(set(requested))
    )).all()
    by_id = {row.id: row for row in rows}
    return tuple(
        (
            _document_type_reference(by_id[value])
            if value in by_id
            else _unresolved_document_type(value, "missing")
        )
        for value in requested
    )


def _requested_identifiers(
    values: _Iterable[str] | None,
) -> tuple[str, ...] | None:
    if values is None:
        return None
    return tuple(str(value).strip() for value in values)


def _reference_access_failure(
    db: _Session,
    actor: _Actor,
    requested: tuple[str, ...] | None,
) -> tuple[ComplianceDocumentTypeReferenceDTO, ...] | None:
    from uok.kernel.module_runtime import (
        OPERATIONAL_STATUSES,
        module_record_status,
    )
    from uok.kernel.security import has_permission as _has_permission

    if not _has_permission(actor, "compliance.read"):
        if requested is None:
            raise PermissionError("compliance.read")
        return tuple(_unresolved_document_type(value, "denied") for value in requested)
    if (
        module_record_status(
            db,
            actor.organization_id,
            "compliance.core",
        )
        in OPERATIONAL_STATUSES
    ):
        return None
    if requested is None:
        raise ValueError("compliance.core is not operational")
    return tuple(_unresolved_document_type(value, "unavailable") for value in requested)


def _document_type_reference(
    row: _Any,
) -> ComplianceDocumentTypeReferenceDTO:
    status: _ReferenceStatus = (
        "ready" if row.status == "active" else "unavailable"
    )
    return ComplianceDocumentTypeReferenceDTO(
        row.id,
        status,
        row.code,
        row.canonical_name,
        row.category,
        row.status,
        f"Compliance Document Type is {row.status}.",
    )


def _unresolved_document_type(
    compliance_document_type_id: str,
    status: _ReferenceStatus,
) -> ComplianceDocumentTypeReferenceDTO:
    summaries = {
        "denied": (
            "The Compliance Document Type target is not visible to this actor."
        ),
        "missing": (
            "The Compliance Document Type target does not exist in this organization."
        ),
        "unavailable": "The Compliance Document Type provider is unavailable.",
    }
    return ComplianceDocumentTypeReferenceDTO(
        compliance_document_type_id,
        status,
        None,
        None,
        None,
        None,
        summaries[status],
    )


def command_handlers() -> dict[str, _Any]:
    from uok_compliance_core._internal.delivery.commands import command_handlers as _provider

    return _provider()


def command_permissions() -> dict[str, str]:
    from uok_compliance_core._internal.delivery.commands import command_permissions as _provider

    return _provider()


def role_grants() -> dict[str, set[str]]:
    from uok_compliance_core._internal.delivery.policy import role_grants as _provider

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
    "ComplianceDocumentTypeReferenceDTO",
    "api_router",
    "command_handlers",
    "command_permissions",
    "resolve_compliance_document_type_references",
    "role_grants",
]

del annotations

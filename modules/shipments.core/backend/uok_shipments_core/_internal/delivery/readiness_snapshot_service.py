from __future__ import annotations

from collections.abc import Iterable
from datetime import date
from typing import Any, Literal
from urllib.parse import quote

from sqlalchemy.orm import Session

from uok.kernel.module_runtime import OPERATIONAL_STATUSES, module_record_status
from uok.kernel.security import Actor, has_permission

from .readiness_snapshot_read_service import (
    ShipmentReadinessFacts,
    read_shipment_readiness_facts,
)

ResolutionStatus = Literal["ready", "unavailable", "denied", "missing"]


def resolve_shipment_readiness_snapshots(
    db: Session,
    actor: Actor,
    as_of: date,
    expiring_soon_through: date,
    shipment_ids: Iterable[str] | None,
    dto_type: Any,
) -> tuple[Any, ...]:
    if expiring_soon_through < as_of:
        raise ValueError("expiring_soon_through cannot be earlier than as_of")
    requested_ids = None if shipment_ids is None else tuple(shipment_ids)
    if not has_permission(actor, "shipments.read"):
        if requested_ids is None:
            raise PermissionError("shipments.read")
        return _unresolved_snapshots(requested_ids, "denied", dto_type)
    if module_record_status(db, actor.organization_id, "shipments.core") not in OPERATIONAL_STATUSES:
        if requested_ids is None:
            raise ValueError("shipments.core is not installed or enabled")
        return _unresolved_snapshots(requested_ids, "unavailable", dto_type)

    facts = read_shipment_readiness_facts(
        db,
        actor.organization_id,
        as_of,
        expiring_soon_through,
        requested_ids,
    )
    if requested_ids is None:
        return tuple(_resolved_snapshot(row, dto_type) for row in facts)
    by_id = {row.shipment_id: row for row in facts}
    return tuple(
        (
            _resolved_snapshot(by_id[shipment_id], dto_type)
            if shipment_id in by_id
            else _unresolved_snapshot(shipment_id, "missing", dto_type)
        )
        for shipment_id in requested_ids
    )


def _resolved_snapshot(
    facts: ShipmentReadinessFacts,
    dto_type: Any,
) -> Any:
    return dto_type(
        shipment_id=facts.shipment_id,
        status="ready",
        code=facts.code,
        lifecycle_status=facts.lifecycle_status,
        required_total=facts.required_total,
        required_satisfied=facts.required_satisfied,
        required_missing=facts.required_missing,
        required_received=facts.required_received,
        required_waived=facts.required_waived,
        required_not_applicable=facts.required_not_applicable,
        optional_total=facts.optional_total,
        document_instance_total=facts.document_instance_total,
        document_instance_draft=facts.document_instance_draft,
        document_instance_recorded=facts.document_instance_recorded,
        document_instance_verified=facts.document_instance_verified,
        document_instance_rejected=facts.document_instance_rejected,
        document_instance_superseded=facts.document_instance_superseded,
        document_instance_expiry_evaluated=(
            facts.document_instance_expiry_evaluated
        ),
        document_instance_expiry_not_recorded=(
            facts.document_instance_expiry_not_recorded
        ),
        document_instance_expired=facts.document_instance_expired,
        document_instance_expiring_soon=(
            facts.document_instance_expiring_soon
        ),
        next_document_expiry_on=facts.next_document_expiry_on,
        status_summary=f"Shipment is {facts.lifecycle_status}; readiness facts are available.",
        open_path=f"/?view=shipments&shipment_id={quote(facts.shipment_id, safe='')}",
    )


def _unresolved_snapshots(
    shipment_ids: tuple[str, ...] | None,
    status: ResolutionStatus,
    dto_type: Any,
) -> tuple[Any, ...]:
    if shipment_ids is None:
        return ()
    return tuple(
        _unresolved_snapshot(shipment_id, status, dto_type)
        for shipment_id in shipment_ids
    )


def _unresolved_snapshot(
    shipment_id: str,
    status: ResolutionStatus,
    dto_type: Any,
) -> Any:
    summaries = {
        "denied": "Shipment readiness facts are not visible to this actor.",
        "missing": "Shipment readiness facts are not available in this organization.",
        "unavailable": "The Shipment provider is unavailable.",
    }
    return dto_type(
        shipment_id=shipment_id,
        status=status,
        code=None,
        lifecycle_status=None,
        required_total=None,
        required_satisfied=None,
        required_missing=None,
        required_received=None,
        required_waived=None,
        required_not_applicable=None,
        optional_total=None,
        document_instance_total=None,
        document_instance_draft=None,
        document_instance_recorded=None,
        document_instance_verified=None,
        document_instance_rejected=None,
        document_instance_superseded=None,
        document_instance_expiry_evaluated=None,
        document_instance_expiry_not_recorded=None,
        document_instance_expired=None,
        document_instance_expiring_soon=None,
        next_document_expiry_on=None,
        status_summary=summaries[status],
        open_path=None,
    )


__all__ = ["resolve_shipment_readiness_snapshots"]

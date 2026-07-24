from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from sqlalchemy.orm import Session

from uok.kernel.security import Actor
from uok_shipments_core.public_api import (
    ShipmentReadinessSnapshotDTO,
    resolve_shipment_readiness_snapshots,
)


@dataclass(frozen=True)
class ShipmentReadinessFacts:
    shipment_id: str
    code: str
    lifecycle_status: str
    open_path: str | None
    required_total: int
    required_satisfied: int
    required_missing: int
    required_received: int
    required_waived: int
    required_not_applicable: int
    optional_total: int
    document_instance_total: int
    document_instance_draft: int
    document_instance_recorded: int
    document_instance_verified: int
    document_instance_rejected: int
    document_instance_superseded: int
    document_instance_expiry_evaluated: int
    document_instance_expiry_not_recorded: int
    document_instance_expired: int
    document_instance_expiring_soon: int
    next_document_expiry_on: date | None


def load_shipment_readiness_facts(
    db: Session,
    actor: Actor,
    as_of: date,
    expiring_soon_through: date,
) -> tuple[ShipmentReadinessFacts, ...]:
    """Load only immutable, owner-authorized Shipment readiness facts."""
    snapshots = resolve_shipment_readiness_snapshots(
        db,
        actor,
        as_of=as_of,
        expiring_soon_through=expiring_soon_through,
    )
    return tuple(
        _ready_facts(snapshot, as_of, expiring_soon_through)
        for snapshot in snapshots
    )


def _ready_facts(
    snapshot: ShipmentReadinessSnapshotDTO,
    as_of: date,
    expiring_soon_through: date,
) -> ShipmentReadinessFacts:
    required_values = (
        snapshot.code,
        snapshot.lifecycle_status,
        snapshot.required_total,
        snapshot.required_satisfied,
        snapshot.required_missing,
        snapshot.required_received,
        snapshot.required_waived,
        snapshot.required_not_applicable,
        snapshot.optional_total,
        snapshot.document_instance_total,
        snapshot.document_instance_draft,
        snapshot.document_instance_recorded,
        snapshot.document_instance_verified,
        snapshot.document_instance_rejected,
        snapshot.document_instance_superseded,
        snapshot.document_instance_expiry_evaluated,
        snapshot.document_instance_expiry_not_recorded,
        snapshot.document_instance_expired,
        snapshot.document_instance_expiring_soon,
    )
    if snapshot.status != "ready" or any(value is None for value in required_values):
        raise ValueError("Shipment readiness source returned an unresolved snapshot")
    _validate_aggregate_invariants(snapshot, as_of, expiring_soon_through)
    return ShipmentReadinessFacts(
        shipment_id=snapshot.shipment_id,
        code=snapshot.code,
        lifecycle_status=snapshot.lifecycle_status,
        open_path=snapshot.open_path,
        required_total=snapshot.required_total,
        required_satisfied=snapshot.required_satisfied,
        required_missing=snapshot.required_missing,
        required_received=snapshot.required_received,
        required_waived=snapshot.required_waived,
        required_not_applicable=snapshot.required_not_applicable,
        optional_total=snapshot.optional_total,
        document_instance_total=snapshot.document_instance_total,
        document_instance_draft=snapshot.document_instance_draft,
        document_instance_recorded=snapshot.document_instance_recorded,
        document_instance_verified=snapshot.document_instance_verified,
        document_instance_rejected=snapshot.document_instance_rejected,
        document_instance_superseded=snapshot.document_instance_superseded,
        document_instance_expiry_evaluated=(
            snapshot.document_instance_expiry_evaluated
        ),
        document_instance_expiry_not_recorded=(
            snapshot.document_instance_expiry_not_recorded
        ),
        document_instance_expired=snapshot.document_instance_expired,
        document_instance_expiring_soon=(
            snapshot.document_instance_expiring_soon
        ),
        next_document_expiry_on=snapshot.next_document_expiry_on,
    )


def _validate_aggregate_invariants(
    snapshot: ShipmentReadinessSnapshotDTO,
    as_of: date,
    expiring_soon_through: date,
) -> None:
    count_fields = (
        snapshot.required_total,
        snapshot.required_satisfied,
        snapshot.required_missing,
        snapshot.required_received,
        snapshot.required_waived,
        snapshot.required_not_applicable,
        snapshot.optional_total,
        snapshot.document_instance_total,
        snapshot.document_instance_draft,
        snapshot.document_instance_recorded,
        snapshot.document_instance_verified,
        snapshot.document_instance_rejected,
        snapshot.document_instance_superseded,
        snapshot.document_instance_expiry_evaluated,
        snapshot.document_instance_expiry_not_recorded,
        snapshot.document_instance_expired,
        snapshot.document_instance_expiring_soon,
    )
    if any(value < 0 for value in count_fields):
        raise ValueError("Shipment readiness source returned a negative count")
    if snapshot.required_total != (
        snapshot.required_missing
        + snapshot.required_received
        + snapshot.required_waived
        + snapshot.required_not_applicable
    ) or snapshot.required_satisfied != (
        snapshot.required_received
        + snapshot.required_waived
        + snapshot.required_not_applicable
    ):
        raise ValueError(
            "Shipment readiness source returned inconsistent requirement counts"
        )
    if snapshot.document_instance_total != (
        snapshot.document_instance_draft
        + snapshot.document_instance_recorded
        + snapshot.document_instance_verified
        + snapshot.document_instance_rejected
        + snapshot.document_instance_superseded
    ):
        raise ValueError(
            "Shipment readiness source returned inconsistent instance counts"
        )
    if snapshot.document_instance_expiry_evaluated != (
        snapshot.document_instance_recorded
        + snapshot.document_instance_verified
    ):
        raise ValueError(
            "Shipment readiness source returned inconsistent expiry eligibility"
        )
    if (
        snapshot.document_instance_expiry_not_recorded
        > snapshot.document_instance_expiry_evaluated
    ):
        raise ValueError(
            "Shipment readiness source returned inconsistent missing expiry counts"
        )
    expiry_with_dates = (
        snapshot.document_instance_expiry_evaluated
        - snapshot.document_instance_expiry_not_recorded
    )
    if (
        snapshot.document_instance_expired
        + snapshot.document_instance_expiring_soon
        > expiry_with_dates
    ):
        raise ValueError(
            "Shipment readiness source returned overlapping expiry counts"
        )
    if (
        snapshot.next_document_expiry_on is not None
        and snapshot.next_document_expiry_on < as_of
    ):
        raise ValueError(
            "Shipment readiness source returned a past next expiry date"
        )
    nonexpired_with_date = expiry_with_dates - snapshot.document_instance_expired
    if (
        (nonexpired_with_date == 0)
        != (snapshot.next_document_expiry_on is None)
    ):
        raise ValueError(
            "Shipment readiness source returned inconsistent next expiry presence"
        )
    next_expiry_is_in_window = (
        snapshot.next_document_expiry_on is not None
        and snapshot.next_document_expiry_on <= expiring_soon_through
    )
    if (
        (snapshot.document_instance_expiring_soon > 0)
        != next_expiry_is_in_window
    ):
        raise ValueError(
            "Shipment readiness source returned inconsistent next expiry window"
        )


__all__ = [
    "ShipmentReadinessFacts",
    "load_shipment_readiness_facts",
]

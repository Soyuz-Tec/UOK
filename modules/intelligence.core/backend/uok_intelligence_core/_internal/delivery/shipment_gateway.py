from __future__ import annotations

from dataclasses import dataclass

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


def load_shipment_readiness_facts(
    db: Session,
    actor: Actor,
) -> tuple[ShipmentReadinessFacts, ...]:
    """Load only immutable, owner-authorized Shipment readiness facts."""
    snapshots = resolve_shipment_readiness_snapshots(db, actor)
    return tuple(_ready_facts(snapshot) for snapshot in snapshots)


def _ready_facts(
    snapshot: ShipmentReadinessSnapshotDTO,
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
    )
    if snapshot.status != "ready" or any(value is None for value in required_values):
        raise ValueError("Shipment readiness source returned an unresolved snapshot")
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
    )


__all__ = [
    "ShipmentReadinessFacts",
    "load_shipment_readiness_facts",
]

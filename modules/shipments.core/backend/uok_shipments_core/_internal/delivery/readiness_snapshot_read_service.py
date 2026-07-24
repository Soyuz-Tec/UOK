from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from uok_shipments_core._internal.persistence.models import (
    Shipment,
    ShipmentDocumentInstance,
    ShipmentDocumentRequirement,
)


@dataclass(frozen=True)
class ShipmentReadinessFacts:
    shipment_id: str
    code: str
    lifecycle_status: str
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


@dataclass(frozen=True)
class _InstanceReadinessCounts:
    total: int = 0
    draft: int = 0
    recorded: int = 0
    verified: int = 0
    rejected: int = 0
    superseded: int = 0
    expiry_evaluated: int = 0
    expiry_not_recorded: int = 0
    expired: int = 0
    expiring_soon: int = 0
    next_expiry_on: date | None = None


def read_shipment_readiness_facts(
    db: Session,
    organization_id: str,
    as_of: date,
    expiring_soon_through: date,
    shipment_ids: Sequence[str] | None = None,
) -> tuple[ShipmentReadinessFacts, ...]:
    shipments = _shipment_rows(db, organization_id, shipment_ids)
    if not shipments:
        return ()

    resolved_ids = tuple(row.id for row in shipments)
    requirement_counts = _requirement_counts(db, organization_id, resolved_ids)
    instance_counts = _instance_counts(
        db,
        organization_id,
        resolved_ids,
        as_of,
        expiring_soon_through,
    )
    return tuple(
        _readiness_facts(
            row.id,
            row.code,
            row.status,
            requirement_counts.get(row.id, (0, 0, 0, 0, 0, 0)),
            instance_counts.get(row.id, _InstanceReadinessCounts()),
        )
        for row in shipments
    )


def _shipment_rows(
    db: Session,
    organization_id: str,
    shipment_ids: Sequence[str] | None,
) -> list[Shipment]:
    query = select(Shipment).where(Shipment.organization_id == organization_id)
    if shipment_ids is not None:
        unique_ids = tuple(dict.fromkeys(shipment_ids))
        if not unique_ids:
            return []
        query = query.where(Shipment.id.in_(unique_ids))
    return list(db.scalars(query.order_by(Shipment.code, Shipment.id)).all())


def _requirement_counts(
    db: Session,
    organization_id: str,
    shipment_ids: tuple[str, ...],
) -> dict[str, tuple[int, int, int, int, int, int]]:
    rows = db.execute(
        select(
            ShipmentDocumentRequirement.shipment_id,
            func.sum(case((
                ShipmentDocumentRequirement.requirement_level == "required",
                1,
            ), else_=0)),
            func.sum(case((
                (ShipmentDocumentRequirement.requirement_level == "required")
                & (ShipmentDocumentRequirement.status == "missing"),
                1,
            ), else_=0)),
            func.sum(case((
                (ShipmentDocumentRequirement.requirement_level == "required")
                & (ShipmentDocumentRequirement.status == "received"),
                1,
            ), else_=0)),
            func.sum(case((
                (ShipmentDocumentRequirement.requirement_level == "required")
                & (ShipmentDocumentRequirement.status == "waived"),
                1,
            ), else_=0)),
            func.sum(case((
                (ShipmentDocumentRequirement.requirement_level == "required")
                & (ShipmentDocumentRequirement.status == "not_applicable"),
                1,
            ), else_=0)),
            func.sum(case((
                ShipmentDocumentRequirement.requirement_level == "optional",
                1,
            ), else_=0)),
        ).where(
            ShipmentDocumentRequirement.organization_id == organization_id,
            ShipmentDocumentRequirement.shipment_id.in_(shipment_ids),
        ).group_by(ShipmentDocumentRequirement.shipment_id)
    ).all()
    return {
        shipment_id: tuple(int(value or 0) for value in values)  # type: ignore[misc]
        for shipment_id, *values in rows
    }


def _instance_counts(
    db: Session,
    organization_id: str,
    shipment_ids: tuple[str, ...],
    as_of: date,
    expiring_soon_through: date,
) -> dict[str, _InstanceReadinessCounts]:
    expiry_eligible = ShipmentDocumentInstance.status.in_(("recorded", "verified"))
    expiry_recorded = ShipmentDocumentInstance.expires_on.is_not(None)
    rows = db.execute(
        select(
            ShipmentDocumentInstance.shipment_id,
            func.count(),
            *(
                func.sum(case((
                    ShipmentDocumentInstance.status == status,
                    1,
                ), else_=0))
                for status in ("draft", "recorded", "verified", "rejected", "superseded")
            ),
            func.sum(case((expiry_eligible, 1), else_=0)),
            func.sum(case((
                expiry_eligible
                & ShipmentDocumentInstance.expires_on.is_(None),
                1,
            ), else_=0)),
            func.sum(case((
                expiry_eligible
                & expiry_recorded
                & (ShipmentDocumentInstance.expires_on < as_of),
                1,
            ), else_=0)),
            func.sum(case((
                expiry_eligible
                & expiry_recorded
                & ShipmentDocumentInstance.expires_on.between(
                    as_of,
                    expiring_soon_through,
                ),
                1,
            ), else_=0)),
            # "Next" is forward-looking; past dates remain visible via expired.
            func.min(case((
                expiry_eligible
                & expiry_recorded
                & (ShipmentDocumentInstance.expires_on >= as_of),
                ShipmentDocumentInstance.expires_on,
            ), else_=None)),
        ).where(
            ShipmentDocumentInstance.organization_id == organization_id,
            ShipmentDocumentInstance.shipment_id.in_(shipment_ids),
        ).group_by(ShipmentDocumentInstance.shipment_id)
    ).all()
    counts: dict[str, _InstanceReadinessCounts] = {}
    for (
        shipment_id,
        total,
        draft,
        recorded,
        verified,
        rejected,
        superseded,
        expiry_evaluated,
        expiry_not_recorded,
        expired,
        expiring_soon,
        next_expiry_on,
    ) in rows:
        counts[shipment_id] = _InstanceReadinessCounts(
            total=int(total or 0),
            draft=int(draft or 0),
            recorded=int(recorded or 0),
            verified=int(verified or 0),
            rejected=int(rejected or 0),
            superseded=int(superseded or 0),
            expiry_evaluated=int(expiry_evaluated or 0),
            expiry_not_recorded=int(expiry_not_recorded or 0),
            expired=int(expired or 0),
            expiring_soon=int(expiring_soon or 0),
            next_expiry_on=next_expiry_on,
        )
    return counts


def _readiness_facts(
    shipment_id: str,
    code: str,
    lifecycle_status: str,
    requirement_counts: tuple[int, int, int, int, int, int],
    instance_counts: _InstanceReadinessCounts,
) -> ShipmentReadinessFacts:
    (
        required_total,
        required_missing,
        required_received,
        required_waived,
        required_not_applicable,
        optional_total,
    ) = requirement_counts
    return ShipmentReadinessFacts(
        shipment_id=shipment_id,
        code=code,
        lifecycle_status=lifecycle_status,
        required_total=required_total,
        required_satisfied=(
            required_received + required_waived + required_not_applicable
        ),
        required_missing=required_missing,
        required_received=required_received,
        required_waived=required_waived,
        required_not_applicable=required_not_applicable,
        optional_total=optional_total,
        document_instance_total=instance_counts.total,
        document_instance_draft=instance_counts.draft,
        document_instance_recorded=instance_counts.recorded,
        document_instance_verified=instance_counts.verified,
        document_instance_rejected=instance_counts.rejected,
        document_instance_superseded=instance_counts.superseded,
        document_instance_expiry_evaluated=instance_counts.expiry_evaluated,
        document_instance_expiry_not_recorded=instance_counts.expiry_not_recorded,
        document_instance_expired=instance_counts.expired,
        document_instance_expiring_soon=instance_counts.expiring_soon,
        next_document_expiry_on=instance_counts.next_expiry_on,
    )


__all__ = ["ShipmentReadinessFacts", "read_shipment_readiness_facts"]

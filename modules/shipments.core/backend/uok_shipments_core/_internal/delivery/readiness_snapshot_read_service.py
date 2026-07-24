from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

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


def read_shipment_readiness_facts(
    db: Session,
    organization_id: str,
    shipment_ids: Sequence[str] | None = None,
) -> tuple[ShipmentReadinessFacts, ...]:
    shipments = _shipment_rows(db, organization_id, shipment_ids)
    if not shipments:
        return ()

    resolved_ids = tuple(row.id for row in shipments)
    requirement_counts = _requirement_counts(db, organization_id, resolved_ids)
    instance_counts = _instance_counts(db, organization_id, resolved_ids)
    return tuple(
        _readiness_facts(
            row.id,
            row.code,
            row.status,
            requirement_counts.get(row.id, (0, 0, 0, 0, 0, 0)),
            instance_counts.get(row.id, (0, 0, 0, 0, 0, 0)),
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
) -> dict[str, tuple[int, int, int, int, int, int]]:
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
        ).where(
            ShipmentDocumentInstance.organization_id == organization_id,
            ShipmentDocumentInstance.shipment_id.in_(shipment_ids),
        ).group_by(ShipmentDocumentInstance.shipment_id)
    ).all()
    return {
        shipment_id: tuple(int(value or 0) for value in values)  # type: ignore[misc]
        for shipment_id, *values in rows
    }


def _readiness_facts(
    shipment_id: str,
    code: str,
    lifecycle_status: str,
    requirement_counts: tuple[int, int, int, int, int, int],
    instance_counts: tuple[int, int, int, int, int, int],
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
        document_instance_total=instance_counts[0],
        document_instance_draft=instance_counts[1],
        document_instance_recorded=instance_counts[2],
        document_instance_verified=instance_counts[3],
        document_instance_rejected=instance_counts[4],
        document_instance_superseded=instance_counts[5],
    )


__all__ = ["ShipmentReadinessFacts", "read_shipment_readiness_facts"]

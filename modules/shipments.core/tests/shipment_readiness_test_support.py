from __future__ import annotations

from uuid import uuid4

from uok.host.security import parse_token
from uok.kernel.security import Actor
from uok_shipments_core._internal.persistence.models import (
    Shipment,
    ShipmentDocumentInstance,
    ShipmentDocumentRequirement,
)
from uok_shipments_core.public_api import ShipmentReadinessSnapshotDTO


FACT_FIELDS = (
    "code",
    "lifecycle_status",
    "required_total",
    "required_satisfied",
    "required_missing",
    "required_received",
    "required_waived",
    "required_not_applicable",
    "optional_total",
    "document_instance_total",
    "document_instance_draft",
    "document_instance_recorded",
    "document_instance_verified",
    "document_instance_rejected",
    "document_instance_superseded",
    "open_path",
)


def actor_from_headers(headers: dict[str, str]) -> Actor:
    return parse_token(headers["Authorization"].split(" ", 1)[1])


def add_shipment(
    db,
    actor: Actor,
    code: str,
    *,
    shipment_id: str | None = None,
    status: str = "draft",
) -> Shipment:
    row = Shipment(
        organization_id=actor.organization_id,
        code=code,
        shipper_party_id=f"shipper-{code}",
        consignee_party_id=f"consignee-{code}",
        origin_location_id=f"origin-{code}",
        destination_location_id=f"destination-{code}",
        route_definition_id=None,
        status=status,
        created_by_user_id=actor.user_id,
        updated_by_user_id=actor.user_id,
    )
    if shipment_id is not None:
        row.id = shipment_id
    db.add(row)
    db.flush()
    return row


def requirement(
    actor: Actor,
    shipment_id: str,
    index: int,
    requirement_level: str,
    status: str,
) -> ShipmentDocumentRequirement:
    return ShipmentDocumentRequirement(
        organization_id=actor.organization_id,
        shipment_id=shipment_id,
        compliance_document_type_id=f"type-{shipment_id}-{index}",
        requirement_level=requirement_level,
        status=status,
        created_by_user_id=actor.user_id,
        updated_by_user_id=actor.user_id,
    )


def document_instance(
    actor: Actor,
    shipment_id: str,
    index: int,
    status: str,
) -> ShipmentDocumentInstance:
    return ShipmentDocumentInstance(
        organization_id=actor.organization_id,
        shipment_id=shipment_id,
        compliance_document_type_id=f"type-{shipment_id}-{index}",
        document_number=f"DOC-{index}",
        status=status,
        created_by_user_id=actor.user_id,
        updated_by_user_id=actor.user_id,
    )


def assert_redacted(
    snapshot: ShipmentReadinessSnapshotDTO,
    status: str,
) -> None:
    assert snapshot.status == status
    assert all(getattr(snapshot, name) is None for name in FACT_FIELDS)


def unique_suffix() -> str:
    return uuid4().hex[:8].upper()


__all__ = [
    "FACT_FIELDS",
    "actor_from_headers",
    "add_shipment",
    "assert_redacted",
    "document_instance",
    "requirement",
    "unique_suffix",
]

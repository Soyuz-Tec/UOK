from __future__ import annotations

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from uok_shipments_core._internal.delivery.document_instance_schemas import (
    ShipmentDocumentInstanceCreateRequest,
    ShipmentDocumentInstanceResponse,
    ShipmentDocumentInstanceStatusRequest,
    ShipmentDocumentInstanceUpdateRequest,
)
from uok_shipments_core._internal.persistence.models import (
    ShipmentDocumentInstance,
    ShipmentDocumentInstanceHistory,
)


def test_instance_contracts_normalize_dates_and_reject_storage_fields() -> None:
    request = ShipmentDocumentInstanceCreateRequest.model_validate({
        "shipment_id": " shipment-1 ",
        "compliance_document_type_id": " type-1 ",
        "requirement_id": " requirement-1 ",
        "document_number": "  INV-2026-0042 ",
        "issuing_party_name": "  Kayilan Export Partner  ",
        "issued_on": "2026-07-01",
        "expires_on": "2026-08-01",
        "notes": "  Metadata only  ",
    })
    assert request.shipment_id == "shipment-1"
    assert request.compliance_document_type_id == "type-1"
    assert request.requirement_id == "requirement-1"
    assert request.document_number == "INV-2026-0042"
    assert request.issuing_party_name == "Kayilan Export Partner"
    assert request.notes == "Metadata only"

    with pytest.raises(ValidationError):
        ShipmentDocumentInstanceCreateRequest.model_validate({
            "shipment_id": "shipment-1",
            "compliance_document_type_id": "type-1",
            "document_number": "INV-1",
            "issued_on": "2026-08-02",
            "expires_on": "2026-08-01",
        })
    with pytest.raises(ValidationError):
        ShipmentDocumentInstanceCreateRequest.model_validate({
            "shipment_id": "shipment-1",
            "compliance_document_type_id": "type-1",
            "document_number": "INV-1",
            "storage_key": "forbidden/object-key",
        })
    with pytest.raises(ValidationError):
        ShipmentDocumentInstanceUpdateRequest.model_validate({
            "shipment_id": "shipment-1",
            "instance_id": "instance-1",
            "expected_version": 1,
            "requirement_id": "relationship-is-immutable",
            "reason": "Forbidden relationship mutation",
        })


def test_requirement_update_is_explicit_only_during_verification() -> None:
    request = ShipmentDocumentInstanceStatusRequest.model_validate({
        "shipment_id": "shipment-1",
        "instance_id": "instance-1",
        "expected_version": 3,
        "new_status": " VERIFIED ",
        "reason": " Evidence reviewed ",
        "mark_requirement_received": True,
        "expected_requirement_version": 1,
    })
    assert request.new_status == "verified"
    assert request.reason == "Evidence reviewed"

    with pytest.raises(ValidationError):
        ShipmentDocumentInstanceStatusRequest.model_validate({
            "shipment_id": "shipment-1",
            "instance_id": "instance-1",
            "expected_version": 1,
            "new_status": "recorded",
            "reason": "Not verification",
            "mark_requirement_received": True,
            "expected_requirement_version": 1,
        })
    with pytest.raises(ValidationError):
        ShipmentDocumentInstanceStatusRequest.model_validate({
            "shipment_id": "shipment-1",
            "instance_id": "instance-1",
            "expected_version": 1,
            "new_status": "verified",
            "reason": "Missing linked version",
            "mark_requirement_received": True,
        })


def test_instance_read_dto_is_frozen_and_schema_has_no_binary_storage() -> None:
    now = datetime.now(timezone.utc)
    response = ShipmentDocumentInstanceResponse(
        id="instance-1",
        shipment_id="shipment-1",
        compliance_document_type_id="type-1",
        requirement_id=None,
        document_number="INV-1",
        issuing_party_name=None,
        issued_on=None,
        expires_on=None,
        status="draft",
        notes=None,
        version=1,
        created_by_user_id="user-1",
        updated_by_user_id="user-1",
        created_at=now,
        updated_at=now,
        document_type={
            "compliance_document_type_id": "type-1",
            "status": "ready",
            "code": "COMMERCIAL-INVOICE",
            "canonical_name": "Commercial Invoice",
            "category": "Trade operations",
            "lifecycle_status": "active",
            "status_summary": "Compliance Document Type is active.",
        },
        requirement=None,
    )
    assert "organization_id" not in response.model_dump()
    with pytest.raises(ValidationError, match="frozen"):
        response.status = "recorded"  # type: ignore[misc]

    forbidden = {
        "blob",
        "bucket",
        "content_bytes",
        "file_name",
        "file_path",
        "file_url",
        "object_key",
        "object_store_key",
        "storage_key",
    }
    for model in (ShipmentDocumentInstance, ShipmentDocumentInstanceHistory):
        assert forbidden.isdisjoint(model.__table__.columns.keys())
        assert all("BINARY" not in str(column.type).upper() for column in model.__table__.columns)


def test_instance_requirement_reference_is_owner_local_and_restrictive() -> None:
    requirement_column = ShipmentDocumentInstance.__table__.columns["requirement_id"]
    foreign_key = next(iter(requirement_column.foreign_keys))
    assert foreign_key.target_fullname == "shipment_document_requirements.id"
    assert foreign_key.ondelete is None
    assert not ShipmentDocumentInstanceHistory.__table__.columns[
        "requirement_id"
    ].foreign_keys

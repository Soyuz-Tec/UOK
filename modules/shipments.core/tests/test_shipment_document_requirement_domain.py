from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from uok_compliance_core.public_api import ComplianceDocumentTypeReferenceDTO
from uok_shipments_core._internal.delivery.compliance_gateway import (
    document_type_resolution_response,
)
from uok_shipments_core._internal.delivery.document_requirement_read_service import (
    _requirement_summary,
)
from uok_shipments_core._internal.delivery.document_requirement_schemas import (
    ShipmentDocumentRequirementAddRequest,
    ShipmentDocumentRequirementResponse,
    ShipmentDocumentRequirementStatusRequest,
    ShipmentDocumentRequirementUpdateRequest,
)


def test_requirement_contracts_normalize_and_reject_unsafe_fields() -> None:
    added = ShipmentDocumentRequirementAddRequest.model_validate({
        "shipment_id": " shipment-1 ",
        "compliance_document_type_id": " type-1 ",
        "requirement_level": " REQUIRED ",
        "notes": "  Original required copy  ",
    })
    assert added.shipment_id == "shipment-1"
    assert added.compliance_document_type_id == "type-1"
    assert added.requirement_level == "required"
    assert added.notes == "Original required copy"

    with pytest.raises(ValidationError):
        ShipmentDocumentRequirementAddRequest.model_validate({
            "shipment_id": "shipment-1",
            "compliance_document_type_id": "type-1",
            "requirement_level": "mandatory",
        })
    with pytest.raises(ValidationError):
        ShipmentDocumentRequirementUpdateRequest.model_validate({
            "shipment_id": "shipment-1",
            "requirement_id": "requirement-1",
            "compliance_document_type_id": "type-2",
            "expected_version": 1,
            "reason": "Type IDs are immutable",
        })
    with pytest.raises(ValidationError):
        ShipmentDocumentRequirementStatusRequest.model_validate({
            "shipment_id": "shipment-1",
            "requirement_id": "requirement-1",
            "expected_version": 0,
            "new_status": "received",
            "reason": " ",
        })


def test_requirement_read_dto_is_frozen_and_excludes_tenant_identity() -> None:
    now = datetime.now(timezone.utc)
    response = ShipmentDocumentRequirementResponse(
        id="requirement-1",
        shipment_id="shipment-1",
        compliance_document_type_id="type-1",
        requirement_level="required",
        status="missing",
        notes=None,
        version=1,
        created_by_user_id="user-1",
        updated_by_user_id="user-1",
        created_at=now,
        updated_at=now,
        document_type={
            "compliance_document_type_id": "type-1",
            "status": "ready",
            "code": "BILL-OF-LADING",
            "canonical_name": "Bill of Lading",
            "category": "Trade operations",
            "lifecycle_status": "active",
            "status_summary": "Compliance Document Type is active.",
        },
    )
    assert "organization_id" not in response.model_dump()
    with pytest.raises(ValidationError, match="frozen"):
        response.status = "received"  # type: ignore[misc]


def test_requirement_summary_is_factual_and_non_blocking() -> None:
    rows = [
        SimpleNamespace(requirement_level="required", status="missing"),
        SimpleNamespace(requirement_level="required", status="received"),
        SimpleNamespace(requirement_level="required", status="waived"),
        SimpleNamespace(requirement_level="required", status="not_applicable"),
        SimpleNamespace(requirement_level="optional", status="missing"),
    ]
    summary = _requirement_summary(rows)  # type: ignore[arg-type]
    assert summary.model_dump() == {
        "required_total": 4,
        "required_satisfied": 3,
        "required_missing": 1,
        "required_received": 1,
        "required_waived": 1,
        "required_not_applicable": 1,
        "optional_total": 1,
    }


def test_denied_compliance_resolution_redacts_stored_identifier() -> None:
    stored_id = "foreign-or-restricted-type"
    response = document_type_resolution_response(
        ComplianceDocumentTypeReferenceDTO(
            stored_id,
            "denied",
            None,
            None,
            None,
            None,
            "The Compliance Document Type target is not visible to this actor.",
        )
    )
    assert response["compliance_document_type_id"] is None
    assert stored_id not in str(response)

from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command

from shipment_test_support import (
    create_compliance_document_type,
    create_requirement_shipment,
    install_shipment_stack,
)


def test_instance_create_rejects_unknown_inactive_and_mismatched_types(
    client: TestClient,
) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    install_shipment_stack(client, admin)
    suffix = uuid4().hex[:8].upper()
    shipment_id = create_requirement_shipment(client, ops, f"VALIDATE{suffix}")
    required_type = create_compliance_document_type(
        client,
        ops,
        f"REQUIRED-TYPE-{suffix}",
        f"Required Type {suffix}",
        f"instance-required-type-{suffix}",
    )
    other_type = create_compliance_document_type(
        client,
        ops,
        f"OTHER-TYPE-{suffix}",
        f"Other Type {suffix}",
        f"instance-other-type-{suffix}",
    )
    required_type_id = str(required_type["id"])
    other_type_id = str(other_type["id"])
    requirement = command(
        client,
        ops,
        "AddShipmentDocumentRequirement",
        {
            "shipment_id": shipment_id,
            "compliance_document_type_id": required_type_id,
            "requirement_level": "required",
        },
        f"instance-validation-requirement-{suffix}",
    )
    assert requirement.status_code == 200, requirement.text
    requirement_id = str(requirement.json()["result"]["id"])

    mismatch = command(
        client,
        ops,
        "CreateShipmentDocumentInstance",
        {
            "shipment_id": shipment_id,
            "compliance_document_type_id": other_type_id,
            "requirement_id": requirement_id,
            "document_number": "MISMATCHED-TYPE",
        },
        f"instance-mismatch-{suffix}",
    )
    assert mismatch.status_code == 400, mismatch.text
    assert requirement_id not in mismatch.text
    assert other_type_id not in mismatch.text

    deactivated = command(
        client,
        ops,
        "DeactivateComplianceDocumentType",
        {
            "compliance_document_type_id": other_type_id,
            "expected_version": 1,
            "reason": "Inactive type validation proof",
        },
        f"instance-deactivate-type-{suffix}",
    )
    assert deactivated.status_code == 200, deactivated.text
    inactive = command(
        client,
        ops,
        "CreateShipmentDocumentInstance",
        {
            "shipment_id": shipment_id,
            "compliance_document_type_id": other_type_id,
            "document_number": "INACTIVE-TYPE",
        },
        f"instance-inactive-{suffix}",
    )
    assert inactive.status_code == 400, inactive.text
    assert other_type_id not in inactive.text

    unknown_type_id = "unknown-document-type"
    unknown = command(
        client,
        ops,
        "CreateShipmentDocumentInstance",
        {
            "shipment_id": shipment_id,
            "compliance_document_type_id": unknown_type_id,
            "document_number": "UNKNOWN-TYPE",
        },
        f"instance-unknown-{suffix}",
    )
    assert unknown.status_code == 400, unknown.text
    assert unknown_type_id not in unknown.text

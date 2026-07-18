from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command

from shipment_test_support import (
    create_compliance_document_type,
    create_requirement_shipment,
    get_document_instances,
    get_document_requirements,
    install_shipment_stack,
)


def test_document_instance_lifecycle_audit_and_readiness_coupling(
    client: TestClient,
) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")
    install_shipment_stack(client, admin)
    suffix = uuid4().hex[:8].upper()
    shipment_id = create_requirement_shipment(client, ops, f"INSTANCE{suffix}")
    document_type = create_compliance_document_type(
        client,
        ops,
        f"COMMERCIAL-INVOICE-{suffix}",
        f"Commercial Invoice {suffix}",
        f"instance-type-{suffix}",
    )
    document_type_id = str(document_type["id"])
    requirement = command(
        client,
        ops,
        "AddShipmentDocumentRequirement",
        {
            "shipment_id": shipment_id,
            "compliance_document_type_id": document_type_id,
            "requirement_level": "required",
            "notes": "Commercial invoice evidence is required.",
        },
        f"instance-requirement-{suffix}",
    )
    assert requirement.status_code == 200, requirement.text
    requirement_id = requirement.json()["result"]["id"]

    create_payload = {
        "shipment_id": shipment_id,
        "compliance_document_type_id": document_type_id,
        "requirement_id": requirement_id,
        "document_number": f"INV-{suffix}-001",
        "issuing_party_name": f"Kayilan Export Partner {suffix}",
        "issued_on": "2026-07-01",
        "expires_on": "2026-08-01",
        "notes": "Metadata captured without a file.",
    }
    create_key = f"instance-create-{suffix}"
    created = command(
        client,
        ops,
        "CreateShipmentDocumentInstance",
        create_payload,
        create_key,
    )
    assert created.status_code == 200, created.text
    instance = created.json()["result"]
    instance_id = instance["id"]
    assert instance["status"] == "draft"
    assert instance["version"] == 1
    assert instance["requirement"] == {
        "id": requirement_id,
        "requirement_level": "required",
        "status": "missing",
        "version": 1,
    }
    assert "organization_id" not in instance
    assert "storage_key" not in str(instance)

    replay = command(
        client,
        ops,
        "CreateShipmentDocumentInstance",
        create_payload,
        create_key,
    )
    assert replay.status_code == 200, replay.text
    assert replay.json()["idempotent"] is True
    assert replay.json()["result"] == instance
    denied = command(
        client,
        viewer,
        "UpdateShipmentDocumentInstance",
        {
            "shipment_id": shipment_id,
            "instance_id": instance_id,
            "expected_version": 1,
            "notes": "Forbidden",
            "reason": "Viewer cannot mutate",
        },
        f"instance-viewer-denied-{suffix}",
    )
    assert denied.status_code == 403, denied.text

    updated = command(
        client,
        ops,
        "UpdateShipmentDocumentInstance",
        {
            "shipment_id": shipment_id,
            "instance_id": instance_id,
            "expected_version": 1,
            "document_number": f"INV-{suffix}-002",
            "notes": "Corrected operator reference.",
            "reason": "Correct external reference",
        },
        f"instance-update-{suffix}",
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["result"]["version"] == 2

    recorded = _set_instance_status(
        client,
        ops,
        shipment_id,
        instance_id,
        2,
        "recorded",
        f"instance-recorded-{suffix}",
    )
    assert recorded.status_code == 200, recorded.text
    assert recorded.json()["result"]["version"] == 3
    before_verification = get_document_requirements(client, viewer, shipment_id)
    assert before_verification["summary"]["required_missing"] == 1

    stale = _set_instance_status(
        client,
        ops,
        shipment_id,
        instance_id,
        2,
        "verified",
        f"instance-stale-{suffix}",
    )
    assert stale.status_code == 400, stale.text
    assert "current version 3" in stale.text

    failed_coupling = command(
        client,
        ops,
        "SetShipmentDocumentInstanceStatus",
        {
            "shipment_id": shipment_id,
            "instance_id": instance_id,
            "expected_version": 3,
            "new_status": "verified",
            "reason": "Stale requirement version must roll back",
            "mark_requirement_received": True,
            "expected_requirement_version": 99,
        },
        f"instance-stale-requirement-{suffix}",
    )
    assert failed_coupling.status_code == 400, failed_coupling.text
    rolled_back = client.get(
        f"/api/shipments/records/{shipment_id}/document-instances/{instance_id}",
        headers=viewer,
    )
    assert rolled_back.status_code == 200, rolled_back.text
    assert rolled_back.json()["status"] == "recorded"
    assert rolled_back.json()["version"] == 3
    assert rolled_back.json()["requirement"]["status"] == "missing"
    assert rolled_back.json()["requirement"]["version"] == 1

    verification_reason = "V" * 500
    verify_payload = {
        "shipment_id": shipment_id,
        "instance_id": instance_id,
        "expected_version": 3,
        "new_status": "verified",
        "reason": verification_reason,
        "mark_requirement_received": True,
        "expected_requirement_version": 1,
    }
    verify_key = f"instance-verified-{suffix}"
    verified = command(
        client,
        ops,
        "SetShipmentDocumentInstanceStatus",
        verify_payload,
        verify_key,
    )
    assert verified.status_code == 200, verified.text
    verified_result = verified.json()["result"]
    assert verified_result["status"] == "verified"
    assert verified_result["version"] == 4
    assert verified_result["requirement"]["status"] == "received"
    assert verified_result["requirement"]["version"] == 2
    verify_replay = command(
        client,
        ops,
        "SetShipmentDocumentInstanceStatus",
        verify_payload,
        verify_key,
    )
    assert verify_replay.status_code == 200, verify_replay.text
    assert verify_replay.json()["idempotent"] is True
    assert verify_replay.json()["result"] == verified_result

    after_verification = get_document_requirements(client, viewer, shipment_id)
    assert after_verification["summary"]["required_missing"] == 0
    assert after_verification["summary"]["required_received"] == 1
    assert after_verification["summary"]["required_satisfied"] == 1
    listed_instances = get_document_instances(client, viewer, shipment_id)
    assert len(listed_instances) == 1
    persisted_result = listed_instances[0]
    for field in (
        "id",
        "shipment_id",
        "compliance_document_type_id",
        "requirement_id",
        "document_number",
        "status",
        "version",
        "document_type",
        "requirement",
    ):
        assert persisted_result[field] == verified_result[field]
    detail = client.get(
        f"/api/shipments/records/{shipment_id}/document-instances/{instance_id}",
        headers=viewer,
    )
    assert detail.status_code == 200, detail.text
    assert detail.json() == persisted_result
    history = client.get(
        (
            f"/api/shipments/records/{shipment_id}/document-instances/"
            f"{instance_id}/history"
        ),
        headers=viewer,
    )
    assert history.status_code == 200, history.text
    assert [row["action"] for row in reversed(history.json())] == [
        "created",
        "updated",
        "status_changed",
        "status_changed",
    ]
    assert [row["version"] for row in reversed(history.json())] == [1, 2, 3, 4]
    requirement_history = client.get(
        (
            f"/api/shipments/records/{shipment_id}/document-requirements/"
            f"{requirement_id}/history"
        ),
        headers=viewer,
    )
    assert requirement_history.status_code == 200, requirement_history.text
    assert requirement_history.json()[0]["reason"] == verification_reason


def _set_instance_status(
    client: TestClient,
    headers: dict[str, str],
    shipment_id: str,
    instance_id: str,
    expected_version: int,
    new_status: str,
    key: str,
):
    return command(
        client,
        headers,
        "SetShipmentDocumentInstanceStatus",
        {
            "shipment_id": shipment_id,
            "instance_id": instance_id,
            "expected_version": expected_version,
            "new_status": new_status,
            "reason": f"Move instance to {new_status}",
        },
        key,
    )

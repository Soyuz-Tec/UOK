from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command

from intelligence_test_support import (
    create_document_type,
    create_shipment,
    install_intelligence_stack,
    other_tenant_headers,
)


def test_readiness_list_never_crosses_tenants(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    suffix = uuid4().hex[:8].upper()
    other = other_tenant_headers(suffix)
    install_intelligence_stack(client, admin)
    install_intelligence_stack(client, other)
    local_id = create_shipment(client, ops, f"LOCAL{suffix}")
    remote_id = create_shipment(client, other, f"REMOTE{suffix}")
    remote_type_id = create_document_type(client, other, f"REMOTE{suffix}")
    created = command(
        client,
        other,
        "CreateShipmentDocumentInstance",
        {
            "shipment_id": remote_id,
            "compliance_document_type_id": remote_type_id,
            "document_number": f"REMOTE-{suffix}",
            "expires_on": "2026-07-17",
        },
        f"remote-expiry-create-{suffix}",
    )
    assert created.status_code == 200, created.text
    remote_instance = created.json()["result"]
    recorded = command(
        client,
        other,
        "SetShipmentDocumentInstanceStatus",
        {
            "shipment_id": remote_id,
            "instance_id": remote_instance["id"],
            "expected_version": remote_instance["version"],
            "new_status": "recorded",
            "reason": "Prove tenant-scoped expiry readiness.",
        },
        f"remote-expiry-recorded-{suffix}",
    )
    assert recorded.status_code == 200, recorded.text

    local = client.get(
        "/api/intelligence/shipment-readiness?as_of=2026-07-18",
        headers=ops,
    )
    remote = client.get(
        "/api/intelligence/shipment-readiness?as_of=2026-07-18",
        headers=other,
    )
    assert local.status_code == 200, local.text
    assert remote.status_code == 200, remote.text
    local_ids = {item["shipment_id"] for item in local.json()["items"]}
    remote_ids = {item["shipment_id"] for item in remote.json()["items"]}
    assert local_id in local_ids
    assert remote_id not in local_ids
    assert remote_id in remote_ids
    assert local_id not in remote_ids
    local_signal = next(
        item for item in local.json()["items"]
        if item["shipment_id"] == local_id
    )
    remote_signal = next(
        item for item in remote.json()["items"]
        if item["shipment_id"] == remote_id
    )
    assert local_signal["document_instance_expiry_evaluated"] == 0
    assert local_signal["document_instance_expired"] == 0
    assert local_signal["document_instance_expiring_soon"] == 0
    assert remote_signal["document_instance_expiry_evaluated"] == 1
    assert remote_signal["document_instance_expired"] == 1
    assert remote_signal["band"] == "attention_required"

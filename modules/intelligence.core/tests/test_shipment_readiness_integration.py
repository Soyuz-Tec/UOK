from __future__ import annotations

from uuid import uuid4

import pytest
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok_intelligence_core._internal.delivery import api as readiness_api
from intelligence_test_support import (
    create_document_type,
    create_shipment,
    install_intelligence_stack,
)


def test_readiness_moves_from_not_assessed_to_attention_to_ready_without_mutation(
    client: TestClient,
) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")
    install_intelligence_stack(client, admin)
    suffix = uuid4().hex[:8].upper()
    shipment_id = create_shipment(client, ops, suffix)
    before = client.get(
        f"/api/shipments/records/{shipment_id}",
        headers=viewer,
    ).json()

    not_assessed = _signal(client, viewer, shipment_id)
    assert not_assessed["band"] == "not_assessed"
    document_type_id = create_document_type(client, ops, suffix)
    added = command(
        client,
        ops,
        "AddShipmentDocumentRequirement",
        {
            "shipment_id": shipment_id,
            "compliance_document_type_id": document_type_id,
            "requirement_level": "required",
        },
        f"readiness-requirement-{suffix}",
    )
    assert added.status_code == 200, added.text
    requirement = added.json()["result"]

    attention = _signal(client, viewer, shipment_id)
    assert attention["band"] == "attention_required"
    assert attention["required_missing"] == 1
    received = command(
        client,
        ops,
        "SetShipmentDocumentRequirementStatus",
        {
            "shipment_id": shipment_id,
            "requirement_id": requirement["id"],
            "expected_version": requirement["version"],
            "new_status": "received",
            "reason": "Metadata received",
        },
        f"readiness-received-{suffix}",
    )
    assert received.status_code == 200, received.text

    ready = _signal(client, viewer, shipment_id)
    assert ready["band"] == "ready"
    assert ready["required_satisfied"] == 1
    after = client.get(
        f"/api/shipments/records/{shipment_id}",
        headers=viewer,
    ).json()
    assert (after["status"], after["version"]) == (
        before["status"],
        before["version"],
    )


def test_readiness_endpoint_enforces_auth_permission_and_lifecycle(
    client: TestClient,
) -> None:
    admin = auth(client, "admin", "admin")
    viewer = auth(client, "viewer", "viewer123")
    install_intelligence_stack(client, admin)
    assert (
        client.get("/api/intelligence/shipment-readiness").status_code == 401
    )
    suffix = uuid4().hex
    registered = client.post(
        "/api/auth/register",
        json={
            "display_name": "Readiness pending user",
            "email": f"readiness-pending-{suffix}@example.test",
            "password": "registered123",
        },
    )
    assert registered.status_code == 200, registered.text
    denied_headers = {
        "Authorization": f"Bearer {registered.json()['access_token']}"
    }
    denied = client.get(
        "/api/intelligence/shipment-readiness",
        headers=denied_headers,
    )
    assert denied.status_code == 403
    assert denied.json()["detail"] == "Permission denied: intelligence.read"

    disabled = client.post(
        "/api/modules/intelligence.core/disable",
        headers=admin,
    )
    assert disabled.status_code == 200, disabled.text
    try:
        unavailable = client.get(
            "/api/intelligence/shipment-readiness",
            headers=viewer,
        )
        assert unavailable.status_code == 400
        assert "not installed or enabled" in unavailable.text
    finally:
        enabled = client.post(
            "/api/modules/intelligence.core/enable",
            headers=admin,
        )
        assert enabled.status_code == 200, enabled.text


def test_shipment_source_denial_and_unavailability_fail_closed(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    admin = auth(client, "admin", "admin")
    viewer = auth(client, "viewer", "viewer123")
    install_intelligence_stack(client, admin)

    def denied_source(*_args: object) -> None:
        raise PermissionError("shipments.read")

    monkeypatch.setattr(
        readiness_api,
        "load_shipment_readiness_facts",
        denied_source,
    )
    denied = client.get(
        "/api/intelligence/shipment-readiness",
        headers=viewer,
    )
    assert denied.status_code == 403
    assert denied.json()["detail"] == (
        "Shipment readiness source is not available to this actor."
    )
    assert "shipments.read" not in denied.text

    def unavailable_source(*_args: object) -> None:
        raise ValueError("shipments.core is not operational")

    monkeypatch.setattr(
        readiness_api,
        "load_shipment_readiness_facts",
        unavailable_source,
    )
    unavailable = client.get(
        "/api/intelligence/shipment-readiness",
        headers=viewer,
    )
    assert unavailable.status_code == 400
    assert unavailable.json()["detail"] == {
        "error": "Shipment readiness source is unavailable."
    }
    assert "shipments.core" not in unavailable.text


def _signal(
    client: TestClient,
    headers: dict[str, str],
    shipment_id: str,
) -> dict[str, object]:
    response = client.get(
        "/api/intelligence/shipment-readiness",
        headers=headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["source_status"] == "ready"
    assert body["source_summary"] == "Shipment readiness source is available."
    return next(
        item
        for item in body["items"]
        if item["shipment_id"] == shipment_id
    )

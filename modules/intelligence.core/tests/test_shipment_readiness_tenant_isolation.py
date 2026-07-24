from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth

from intelligence_test_support import (
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

    local = client.get(
        "/api/intelligence/shipment-readiness",
        headers=ops,
    )
    remote = client.get(
        "/api/intelligence/shipment-readiness",
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

from __future__ import annotations

from dataclasses import FrozenInstanceError
from uuid import uuid4

import pytest
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.host.database import SessionLocal
from uok.host.security import parse_token
from uok.kernel.security import Actor
from uok_shipments_core.public_api import resolve_shipment_reference

from shipment_test_support import (
    create_location,
    create_party,
    create_route,
    install_shipment_stack,
    shipment_payload,
)


def test_shipment_reference_resolver_is_tenant_permission_and_lifecycle_aware(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    install_shipment_stack(client, admin)
    suffix = uuid4().hex[:8].upper()
    shipper_id = create_party(client, ops, f"Reference Shipper {suffix}", f"ref-shipper-{suffix}")
    consignee_id = create_party(client, ops, f"Reference Consignee {suffix}", f"ref-consignee-{suffix}")
    origin_id = create_location(
        client, ops, f"REF-ORIGIN-{suffix}", f"Reference Origin {suffix}", "NG", f"ref-origin-{suffix}",
    )
    destination_id = create_location(
        client, ops, f"REF-DEST-{suffix}", f"Reference Destination {suffix}", "IN", f"ref-dest-{suffix}",
    )
    route_id = create_route(
        client,
        ops,
        f"REF-ROUTE-{suffix}",
        f"Reference Route {suffix}",
        origin_id,
        destination_id,
        f"ref-route-{suffix}",
    )
    created = command(client, ops, "CreateShipment", shipment_payload(
        f"REFERENCE-{suffix}",
        shipper_id,
        consignee_id,
        origin_id,
        destination_id,
        route_id,
    ), f"ref-shipment-{suffix}")
    assert created.status_code == 200, created.text
    shipment_id = created.json()["result"]["id"]
    actor = parse_token(ops["Authorization"].split(" ", 1)[1])

    with SessionLocal() as db:
        ready = resolve_shipment_reference(db, actor, shipment_id)
        assert ready.status == "ready"
        assert ready.lifecycle_status == "draft"
        with pytest.raises(FrozenInstanceError):
            ready.code = "CHANGED"  # type: ignore[misc]
        assert resolve_shipment_reference(db, actor, "missing-shipment").status == "missing"
        denied_actor = Actor(actor.user_id, actor.username, actor.organization_id, "registered_user")
        denied = resolve_shipment_reference(db, denied_actor, shipment_id)
        assert denied.status == "denied"
        assert denied.code is None

    assert client.post("/api/modules/shipments.core/disable", headers=admin).status_code == 200
    try:
        with SessionLocal() as db:
            unavailable = resolve_shipment_reference(db, actor, shipment_id)
            assert unavailable.status == "unavailable"
            assert unavailable.code is None
    finally:
        assert client.post("/api/modules/shipments.core/enable", headers=admin).status_code == 200

from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.host.database import SessionLocal
from uok.host.security import issue_token, parse_token
from uok.kernel.security import Actor
from uok.kernel_models import Membership, Organization, User
from uok_shipments_core.public_api import resolve_shipment_reference

from shipment_test_support import (
    create_location,
    create_party,
    create_route,
    install_shipment_stack,
    shipment_payload,
)


def test_shipments_and_all_owner_references_are_tenant_scoped(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    suffix = uuid4().hex[:8].upper()
    other = _other_tenant_headers(suffix)
    install_shipment_stack(client, admin)
    install_shipment_stack(client, other)

    local_refs = _create_reference_stack(client, ops, suffix, "LOCAL")
    remote_refs = _create_reference_stack(client, other, suffix, "REMOTE")
    shared_code = f"RCN-TENANT-{suffix}"
    local = command(client, ops, "CreateShipment", shipment_payload(
        shared_code, *local_refs,
    ), f"local-shipment-{suffix}")
    remote = command(client, other, "CreateShipment", shipment_payload(
        shared_code, *remote_refs,
    ), f"remote-shipment-{suffix}")
    assert local.status_code == 200, local.text
    assert remote.status_code == 200, remote.text
    local_id = local.json()["result"]["id"]
    remote_id = remote.json()["result"]["id"]
    assert local_id != remote_id

    assert client.get(f"/api/shipments/records/{remote_id}", headers=ops).status_code == 404
    assert client.get(f"/api/shipments/records/{remote_id}/status-history", headers=ops).status_code == 404
    assert client.get(f"/api/shipments/records/{local_id}", headers=other).status_code == 404
    assert all(row["id"] != remote_id for row in client.get("/api/shipments/records", headers=ops).json())

    cross_owner = command(client, ops, "CreateShipment", shipment_payload(
        f"FOREIGN-OWNER-{suffix}", *remote_refs,
    ), f"foreign-owner-shipment-{suffix}")
    assert cross_owner.status_code == 400, cross_owner.text
    assert ":missing" in cross_owner.text

    cross_update = command(client, ops, "UpdateShipment", {
        "shipment_id": remote_id,
        "expected_version": 1,
        "planned_arrival_on": "2026-08-23",
    }, f"foreign-update-{suffix}")
    assert cross_update.status_code == 400, cross_update.text
    assert "shipment not found" in cross_update.text
    cross_transition = command(client, ops, "TransitionShipmentStatus", {
        "shipment_id": remote_id,
        "expected_version": 1,
        "new_status": "planned",
        "reason": "Forbidden",
    }, f"foreign-transition-{suffix}")
    assert cross_transition.status_code == 400, cross_transition.text
    assert "shipment not found" in cross_transition.text

    local_actor = parse_token(ops["Authorization"].split(" ", 1)[1])
    with SessionLocal() as db:
        assert resolve_shipment_reference(db, local_actor, remote_id).status == "missing"
        assert resolve_shipment_reference(db, local_actor, local_id).status == "ready"


def _create_reference_stack(
    client: TestClient,
    headers: dict[str, str],
    suffix: str,
    scope: str,
) -> tuple[str, str, str, str, str]:
    shipper_id = create_party(
        client, headers, f"{scope} Shipper {suffix}", f"{scope.lower()}-shipper-{suffix}",
    )
    consignee_id = create_party(
        client, headers, f"{scope} Consignee {suffix}", f"{scope.lower()}-consignee-{suffix}",
    )
    origin_id = create_location(
        client,
        headers,
        f"{scope}-ORIGIN-{suffix}",
        f"{scope} Origin {suffix}",
        "NG",
        f"{scope.lower()}-origin-{suffix}",
    )
    destination_id = create_location(
        client,
        headers,
        f"{scope}-DEST-{suffix}",
        f"{scope} Destination {suffix}",
        "IN",
        f"{scope.lower()}-destination-{suffix}",
    )
    route_id = create_route(
        client,
        headers,
        f"{scope}-ROUTE-{suffix}",
        f"{scope} Corridor {suffix}",
        origin_id,
        destination_id,
        f"{scope.lower()}-route-{suffix}",
    )
    return shipper_id, consignee_id, origin_id, destination_id, route_id


def _other_tenant_headers(suffix: str) -> dict[str, str]:
    with SessionLocal() as db:
        organization = Organization(name=f"Shipment Support tenant {suffix}")
        user = User(
            username=f"shipment-support-{suffix.lower()}@example.test",
            password_hash="not-used",
            display_name="Shipment Support tenant admin",
        )
        db.add_all((organization, user))
        db.flush()
        db.add(Membership(organization_id=organization.id, user_id=user.id, role="platform_admin"))
        db.commit()
        actor = Actor(user.id, user.username, organization.id, "platform_admin")
    return {"Authorization": f"Bearer {issue_token(actor)}"}

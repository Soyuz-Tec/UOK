from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command, user_id
from uok.host.database import SessionLocal
from uok_shipments_core._internal.persistence.models import Shipment

from shipment_test_support import (
    create_location,
    install_shipment_stack,
    shipment_payload,
)


def test_shipment_redacts_denied_private_and_team_party_ids_from_viewer_reads(
    client: TestClient,
) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")
    install_shipment_stack(client, admin)
    suffix = uuid4().hex[:8].upper()
    private_party = command(client, ops, "CreateContact", {
        "party_type": "organization",
        "display_name": f"Private Shipper {suffix}",
        "owner_user_id": user_id("trader"),
        "visibility_scope": "private",
    }, f"shipment-private-party-{suffix}")
    assert private_party.status_code == 200, private_party.text
    private_party_id = private_party.json()["result"]["contact_id"]
    team = command(client, ops, "CreateContactTeam", {
        "name": f"Shipment Team {suffix}",
    }, f"shipment-team-{suffix}")
    assert team.status_code == 200, team.text
    team_party = command(client, ops, "CreateContact", {
        "party_type": "organization",
        "display_name": f"Team Consignee {suffix}",
        "owner_user_id": user_id("trader"),
        "team_id": team.json()["result"]["id"],
        "visibility_scope": "team",
    }, f"shipment-team-party-{suffix}")
    assert team_party.status_code == 200, team_party.text
    team_party_id = team_party.json()["result"]["contact_id"]
    origin_id = create_location(
        client, ops, f"NG-PRIVATE-{suffix}", f"Private Origin {suffix}", "NG", f"private-origin-{suffix}",
    )
    destination_id = create_location(
        client, ops, f"IN-PRIVATE-{suffix}", f"Private Destination {suffix}", "IN", f"private-destination-{suffix}",
    )
    created = command(client, ops, "CreateShipment", shipment_payload(
        f"PRIVATE-SHIPMENT-{suffix}",
        private_party_id,
        team_party_id,
        origin_id,
        destination_id,
        None,
    ), f"private-shipment-{suffix}")
    assert created.status_code == 200, created.text
    shipment_id = created.json()["result"]["id"]

    detail = client.get(f"/api/shipments/records/{shipment_id}", headers=viewer)
    assert detail.status_code == 200, detail.text
    assert detail.json()["shipper"]["status"] == "denied"
    assert detail.json()["consignee"]["status"] == "denied"
    assert detail.json()["shipper_party_id"] is None
    assert detail.json()["consignee_party_id"] is None
    assert private_party_id not in detail.text
    assert team_party_id not in detail.text
    rows = client.get(f"/api/shipments/records?search={suffix}", headers=viewer)
    assert rows.status_code == 200, rows.text
    listed = next(row for row in rows.json() if row["id"] == shipment_id)
    assert listed["shipper_party_id"] is None
    assert listed["consignee_party_id"] is None
    assert private_party_id not in rows.text
    assert team_party_id not in rows.text

    with SessionLocal() as db:
        stored = db.get(Shipment, shipment_id)
        assert stored is not None
        assert stored.shipper_party_id == private_party_id
        assert stored.consignee_party_id == team_party_id

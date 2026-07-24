from __future__ import annotations

from uuid import uuid4

from sqlalchemy import select
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.host.database import SessionLocal
from uok.host.security import parse_token
from uok.kernel_models import EventRecord
from uok.util import loads
from uok_shipments_core.public_api import resolve_shipment_reference

from shipment_test_support import (
    create_location,
    create_party,
    create_route,
    install_shipment_stack,
    shipment_payload,
)


def test_shipment_header_lifecycle_is_idempotent_versioned_and_audited(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")
    install_shipment_stack(client, admin)
    suffix = uuid4().hex[:8].upper()
    shipper_id = create_party(client, ops, f"RCN Shipper {suffix}", f"shipment-shipper-{suffix}")
    consignee_id = create_party(client, ops, f"VOC Consignee {suffix}", f"shipment-consignee-{suffix}")
    origin_id = create_location(
        client, ops, f"NG-ORIGIN-{suffix}", f"Africa Origin {suffix}", "NG", f"shipment-origin-{suffix}",
    )
    destination_id = create_location(
        client, ops, f"IN-VOC-{suffix}", f"V.O.C. Port {suffix}", "IN", f"shipment-destination-{suffix}",
    )
    route_id = create_route(
        client,
        ops,
        f"RCN-CORRIDOR-{suffix}",
        f"Africa to V.O.C. {suffix}",
        origin_id,
        destination_id,
        f"shipment-route-{suffix}",
    )
    payload = shipment_payload(
        f" rcn__africa_voc_{suffix} ",
        shipper_id,
        consignee_id,
        origin_id,
        destination_id,
        route_id,
    )
    create_key = f"shipment-create-{suffix}"
    created = command(client, ops, "CreateShipment", payload, create_key)
    assert created.status_code == 200, created.text
    created_body = created.json()
    shipment = created_body["result"]
    shipment_id = shipment["id"]
    assert shipment["code"] == f"RCN-AFRICA-VOC-{suffix}"
    assert shipment["status"] == "draft"
    assert shipment["version"] == 1
    assert shipment["shipper"]["display_label"] == f"RCN Shipper {suffix}"
    assert shipment["origin"]["location_definition_id"] == origin_id
    assert shipment["route"]["ordered_location_ids"] == [origin_id, destination_id]
    assert shipment["correlation_id"] == created_body["command_id"]

    replay = command(client, ops, "CreateShipment", payload, create_key)
    assert replay.status_code == 200, replay.text
    assert replay.json()["idempotent"] is True
    assert replay.json()["result"] == shipment
    duplicate = command(client, ops, "CreateShipment", payload, f"shipment-duplicate-{suffix}")
    assert duplicate.status_code == 400, duplicate.text
    denied = command(client, viewer, "CreateShipment", payload, f"shipment-denied-{suffix}")
    assert denied.status_code == 403, denied.text

    detail = client.get(f"/api/shipments/records/{shipment_id}", headers=viewer)
    assert detail.status_code == 200, detail.text
    assert detail.json()["id"] == shipment_id
    rows = client.get(f"/api/shipments/records?search={suffix}&status=draft", headers=viewer)
    assert rows.status_code == 200, rows.text
    assert [row["id"] for row in rows.json()] == [shipment_id]

    updated = command(client, ops, "UpdateShipment", {
        "shipment_id": shipment_id,
        "expected_version": 1,
        "planned_departure_on": "2026-08-02",
        "planned_arrival_on": "2026-08-22",
    }, f"shipment-update-{suffix}")
    assert updated.status_code == 200, updated.text
    assert updated.json()["result"]["version"] == 2
    assert updated.json()["result"]["planned_departure_on"] == "2026-08-02"

    status_commands = [
        ("planned", "Approved operating plan"),
        ("in_transit", "Departed origin"),
        ("arrived", "Arrived at V.O.C."),
        ("closed", "Operational movement complete"),
    ]
    version = 2
    command_ids = {created_body["command_id"], updated.json()["command_id"]}
    for new_status, reason in status_commands:
        transitioned = command(client, ops, "TransitionShipmentStatus", {
            "shipment_id": shipment_id,
            "expected_version": version,
            "new_status": new_status,
            "reason": reason,
        }, f"shipment-{new_status}-{suffix}")
        assert transitioned.status_code == 200, transitioned.text
        version += 1
        assert transitioned.json()["result"]["status"] == new_status
        assert transitioned.json()["result"]["version"] == version
        command_ids.add(transitioned.json()["command_id"])

    history = client.get(f"/api/shipments/records/{shipment_id}/status-history", headers=viewer)
    assert history.status_code == 200, history.text
    assert [row["new_status"] for row in reversed(history.json())] == [
        "planned", "in_transit", "arrived", "closed",
    ]
    assert [row["version"] for row in reversed(history.json())] == [3, 4, 5, 6]

    terminal = command(client, ops, "TransitionShipmentStatus", {
        "shipment_id": shipment_id,
        "expected_version": 6,
        "new_status": "cancelled",
        "reason": "Should fail",
    }, f"shipment-terminal-{suffix}")
    assert terminal.status_code == 400, terminal.text
    edit_closed = command(client, ops, "UpdateShipment", {
        "shipment_id": shipment_id,
        "expected_version": 6,
        "planned_arrival_on": "2026-08-23",
    }, f"shipment-edit-closed-{suffix}")
    assert edit_closed.status_code == 400, edit_closed.text

    actor = parse_token(ops["Authorization"].split(" ", 1)[1])
    with SessionLocal() as db:
        reference = resolve_shipment_reference(db, actor, shipment_id)
        assert reference.status == "ready"
        assert reference.lifecycle_status == "closed"
        assert reference.open_path == f"/?view=shipments&shipment_id={shipment_id}"
        events = db.scalars(select(EventRecord).where(
            EventRecord.object_type == "Shipment",
            EventRecord.object_id == shipment_id,
        )).all()
        assert {event.event_type for event in events} == {
            "ShipmentCreated", "ShipmentUpdated", "ShipmentStatusTransitioned",
        }
        assert {loads(event.payload_json)["correlation_id"] for event in events} == command_ids


def test_shipment_rejects_missing_owner_references_and_route_endpoint_mismatch(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    install_shipment_stack(client, admin)
    suffix = uuid4().hex[:8].upper()
    shipper_id = create_party(client, ops, f"Boundary Shipper {suffix}", f"boundary-shipper-{suffix}")
    consignee_id = create_party(client, ops, f"Boundary Consignee {suffix}", f"boundary-consignee-{suffix}")
    origin_id = create_location(
        client, ops, f"NG-BND-ORIGIN-{suffix}", f"Boundary Origin {suffix}", "NG", f"boundary-origin-{suffix}",
    )
    destination_id = create_location(
        client, ops, f"IN-BND-DEST-{suffix}", f"Boundary Destination {suffix}", "IN", f"boundary-dest-{suffix}",
    )
    other_id = create_location(
        client, ops, f"IN-BND-OTHER-{suffix}", f"Other Destination {suffix}", "IN", f"boundary-other-{suffix}",
    )
    mismatched_route_id = create_route(
        client,
        ops,
        f"BND-ROUTE-{suffix}",
        f"Boundary Route {suffix}",
        origin_id,
        other_id,
        f"boundary-route-{suffix}",
    )
    mismatched = command(client, ops, "CreateShipment", shipment_payload(
        f"BND-SHIPMENT-{suffix}",
        shipper_id,
        consignee_id,
        origin_id,
        destination_id,
        mismatched_route_id,
    ), f"boundary-shipment-{suffix}")
    assert mismatched.status_code == 400, mismatched.text
    assert "Route endpoints must match" in mismatched.text

    missing_party = command(client, ops, "CreateShipment", shipment_payload(
        f"BND-MISSING-{suffix}",
        "missing-party",
        consignee_id,
        origin_id,
        destination_id,
        None,
    ), f"boundary-missing-{suffix}")
    assert missing_party.status_code == 400, missing_party.text
    assert "missing-party:missing" in missing_party.text


def test_shipment_retains_stable_route_id_when_owner_is_later_archived(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    install_shipment_stack(client, admin)
    suffix = uuid4().hex[:8].upper()
    shipper_id = create_party(client, ops, f"Retained Shipper {suffix}", f"retained-shipper-{suffix}")
    consignee_id = create_party(
        client, ops, f"Retained Consignee {suffix}", f"retained-consignee-{suffix}",
    )
    origin_id = create_location(
        client, ops, f"RET-ORIGIN-{suffix}", f"Retained Origin {suffix}", "NG", f"retained-origin-{suffix}",
    )
    destination_id = create_location(
        client, ops, f"RET-DEST-{suffix}", f"Retained Destination {suffix}", "IN", f"retained-dest-{suffix}",
    )
    route_id = create_route(
        client,
        ops,
        f"RET-ROUTE-{suffix}",
        f"Retained Route {suffix}",
        origin_id,
        destination_id,
        f"retained-route-{suffix}",
    )
    created = command(client, ops, "CreateShipment", shipment_payload(
        f"RET-SHIPMENT-{suffix}",
        shipper_id,
        consignee_id,
        origin_id,
        destination_id,
        route_id,
    ), f"retained-shipment-{suffix}")
    assert created.status_code == 200, created.text
    shipment_id = created.json()["result"]["id"]

    archived = command(client, ops, "ArchiveRouteDefinition", {
        "route_definition_id": route_id,
        "expected_version": 1,
    }, f"retained-route-archive-{suffix}")
    assert archived.status_code == 200, archived.text
    detail = client.get(f"/api/shipments/records/{shipment_id}", headers=ops)
    assert detail.status_code == 200, detail.text
    assert detail.json()["route_definition_id"] == route_id
    assert detail.json()["route"]["status"] == "unavailable"
    assert detail.json()["route"]["ordered_location_ids"] == [origin_id, destination_id]

    date_only_update = command(client, ops, "UpdateShipment", {
        "shipment_id": shipment_id,
        "expected_version": 1,
        "planned_arrival_on": "2026-08-22",
    }, f"retained-date-update-{suffix}")
    assert date_only_update.status_code == 200, date_only_update.text
    assert date_only_update.json()["result"]["route"]["status"] == "unavailable"

    rejected_new_use = command(client, ops, "CreateShipment", shipment_payload(
        f"RET-SECOND-{suffix}",
        shipper_id,
        consignee_id,
        origin_id,
        destination_id,
        route_id,
    ), f"retained-second-{suffix}")
    assert rejected_new_use.status_code == 400, rejected_new_use.text
    assert f"{route_id}:unavailable" in rejected_new_use.text

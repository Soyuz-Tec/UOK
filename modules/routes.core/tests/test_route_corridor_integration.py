from __future__ import annotations

from uuid import uuid4

from sqlalchemy import select
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.host.database import SessionLocal
from uok.kernel_models import EventRecord
from uok.util import loads

from route_test_support import create_location, create_route, install_route_stack


def test_route_definition_lifecycle_is_idempotent_versioned_and_audited(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")
    install_route_stack(client, admin)
    suffix = uuid4().hex[:8].upper()
    locations = [
        create_location(client, ops, f"RT-{label}-{suffix}", f"Route {label} {suffix}", kind)
        for label, kind in (("ORIGIN", "warehouse"), ("WP1", "city"), ("WP2", "port"), ("DEST", "port"))
    ]
    location_ids = [str(row["id"]) for row in locations]
    create_key = f"route-create-{suffix}"
    created = create_route(
        client,
        ops,
        f" rcn__route_{suffix} ",
        f"RCN Route {suffix}",
        location_ids,
        create_key,
    )
    assert created.status_code == 200, created.text
    created_body = created.json()
    route = created_body["result"]
    route_id = route["id"]
    assert route["code"] == f"RCN-ROUTE-{suffix}"
    assert route["version"] == 1
    assert route["correlation_id"] == created_body["command_id"]
    assert [stop["stop_role"] for stop in route["stops"]] == [
        "origin", "waypoint", "waypoint", "destination",
    ]
    assert [stop["location"]["location_definition_id"] for stop in route["stops"]] == location_ids

    replay = create_route(
        client,
        ops,
        f" rcn__route_{suffix} ",
        f"RCN Route {suffix}",
        location_ids,
        create_key,
    )
    assert replay.status_code == 200, replay.text
    assert replay.json()["idempotent"] is True
    assert replay.json()["result"] == route
    duplicate = create_route(
        client, ops, f"RCN-ROUTE-{suffix}", f"Duplicate {suffix}", location_ids, f"duplicate-{suffix}",
    )
    assert duplicate.status_code == 400, duplicate.text
    denied = create_route(
        client, viewer, f"DENIED-{suffix}", f"Denied {suffix}", location_ids, f"route-denied-{suffix}",
    )
    assert denied.status_code == 403, denied.text

    detail = client.get(f"/api/routes/definitions/{route_id}", headers=viewer)
    assert detail.status_code == 200, detail.text
    reordered_ids = [location_ids[0], location_ids[2], location_ids[1], location_ids[3]]
    updated = command(client, ops, "UpdateRouteDefinition", {
        "route_definition_id": route_id,
        "expected_version": 1,
        "canonical_name": f"RCN Trade Corridor {suffix}",
        "mode_hint": "sea",
        "origin_location_id": reordered_ids[0],
        "waypoint_location_ids": reordered_ids[1:-1],
        "destination_location_id": reordered_ids[-1],
        "reason": "Align route master and waypoint order",
    }, f"route-update-{suffix}")
    assert updated.status_code == 200, updated.text
    updated_body = updated.json()
    assert updated_body["result"]["version"] == 2
    assert updated_body["result"]["mode_hint"] == "sea"
    assert [stop["location"]["location_definition_id"] for stop in updated_body["result"]["stops"]] == reordered_ids

    history = client.get(f"/api/routes/definitions/{route_id}/name-history", headers=viewer)
    assert history.status_code == 200, history.text
    assert len(history.json()) == 1
    assert history.json()[0]["previous_name"] == f"RCN Route {suffix}"
    assert history.json()[0]["new_name"] == f"RCN Trade Corridor {suffix}"
    assert history.json()[0]["reason"] == "Align route master and waypoint order"

    stale = command(client, ops, "ArchiveRouteDefinition", {
        "route_definition_id": route_id,
        "expected_version": 1,
    }, f"route-stale-{suffix}")
    assert stale.status_code == 400, stale.text
    archived = command(client, ops, "ArchiveRouteDefinition", {
        "route_definition_id": route_id,
        "expected_version": 2,
    }, f"route-archive-{suffix}")
    assert archived.status_code == 200, archived.text
    assert archived.json()["result"]["status"] == "archived"
    assert all(row["id"] != route_id for row in client.get("/api/routes/definitions", headers=viewer).json())
    all_rows = client.get("/api/routes/definitions?include_archived=true", headers=viewer).json()
    assert any(row["id"] == route_id and row["status"] == "archived" for row in all_rows)

    restored = command(client, ops, "RestoreRouteDefinition", {
        "route_definition_id": route_id,
        "expected_version": 3,
    }, f"route-restore-{suffix}")
    assert restored.status_code == 200, restored.text
    assert restored.json()["result"]["status"] == "active"
    assert restored.json()["result"]["version"] == 4

    with SessionLocal() as db:
        events = db.scalars(select(EventRecord).where(
            EventRecord.object_type == "RouteDefinition",
            EventRecord.object_id == route_id,
        )).all()
        assert {event.event_type for event in events} == {
            "RouteDefinitionCreated", "RouteDefinitionUpdated", "RouteDefinitionArchived", "RouteDefinitionRestored",
        }
        payloads = {event.event_type: loads(event.payload_json) for event in events}
        assert payloads["RouteDefinitionCreated"]["ordered_location_ids"] == location_ids
        assert payloads["RouteDefinitionUpdated"]["ordered_location_ids"] == reordered_ids
        assert payloads["RouteDefinitionUpdated"]["changed_fields"] == ["canonical_name", "mode_hint", "path"]

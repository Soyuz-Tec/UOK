from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command

from route_test_support import create_location, create_route, install_route_stack


def test_route_uses_location_owner_options_and_preserves_later_unavailable_state(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")
    install_route_stack(client, admin)
    suffix = uuid4().hex[:8].upper()
    origin = create_location(client, ops, f"BOUND-ORIGIN-{suffix}", f"Boundary Origin {suffix}")
    destination = create_location(client, ops, f"BOUND-DEST-{suffix}", f"Boundary Destination {suffix}")
    ids = [str(origin["id"]), str(destination["id"])]

    options = client.get("/api/routes/location-options", headers=viewer)
    assert options.status_code == 200, options.text
    assert set(ids).issubset({row["location_definition_id"] for row in options.json()})
    created = create_route(client, ops, f"BOUNDARY-{suffix}", f"Boundary {suffix}", ids, f"boundary-{suffix}")
    assert created.status_code == 200, created.text
    route_id = created.json()["result"]["id"]

    archived = command(client, ops, "ArchiveLocationDefinition", {
        "location_definition_id": destination["id"],
        "expected_version": 1,
    }, f"archive-destination-{suffix}")
    assert archived.status_code == 200, archived.text
    detail = client.get(f"/api/routes/definitions/{route_id}", headers=viewer)
    assert detail.status_code == 200, detail.text
    assert detail.json()["stops"][-1]["location"]["status"] == "unavailable"
    assert detail.json()["stops"][-1]["location"]["canonical_name"] == f"Boundary Destination {suffix}"

    invalid_path = command(client, ops, "UpdateRouteDefinition", {
        "route_definition_id": route_id,
        "expected_version": 1,
        "origin_location_id": ids[0],
        "waypoint_location_ids": [],
        "destination_location_id": ids[1],
    }, f"invalid-path-{suffix}")
    assert invalid_path.status_code == 400, invalid_path.text
    assert "unavailable" in invalid_path.text


def test_route_create_rejects_missing_and_repeated_location_ids(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    install_route_stack(client, admin)
    suffix = uuid4().hex[:8].upper()
    origin = create_location(client, ops, f"VALID-ORIGIN-{suffix}", f"Valid Origin {suffix}")
    missing = create_route(
        client,
        ops,
        f"MISSING-{suffix}",
        f"Missing {suffix}",
        [str(origin["id"]), f"missing-{suffix}"],
        f"missing-route-{suffix}",
    )
    assert missing.status_code == 400, missing.text
    assert "missing" in missing.text
    repeated = create_route(
        client,
        ops,
        f"REPEAT-{suffix}",
        f"Repeat {suffix}",
        [str(origin["id"]), str(origin["id"])],
        f"repeat-route-{suffix}",
    )
    assert repeated.status_code == 400, repeated.text
    assert "repeat" in repeated.text.lower()

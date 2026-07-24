from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command


def test_planning_shipment_link_resolves_only_through_owner_facade(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    for module_name in (
        "compliance.core",
        "contacts.core",
        "locations.core",
        "routes.core",
        "shipments.core",
        "calendar.core",
        "planning.core",
    ):
        installed = client.post(f"/api/modules/{module_name}/install", headers=admin)
        assert installed.status_code == 200, installed.text

    suffix = uuid4().hex[:8].upper()
    shipper_id = _party(client, ops, f"Planning Shipper {suffix}", f"planning-shipper-{suffix}")
    consignee_id = _party(client, ops, f"Planning Consignee {suffix}", f"planning-consignee-{suffix}")
    origin_id = _location(
        client,
        ops,
        f"NG-PLANNING-{suffix}",
        f"Planning Africa Origin {suffix}",
        "NG",
        f"planning-origin-{suffix}",
    )
    destination_id = _location(
        client,
        ops,
        f"IN-PLANNING-{suffix}",
        f"Planning V.O.C. Destination {suffix}",
        "IN",
        f"planning-destination-{suffix}",
    )
    route = command(
        client,
        ops,
        "CreateRouteDefinition",
        {
            "code": f"PLANNING-ROUTE-{suffix}",
            "canonical_name": f"Planning Shipment Corridor {suffix}",
            "mode_hint": "sea",
            "origin_location_id": origin_id,
            "waypoint_location_ids": [],
            "destination_location_id": destination_id,
        },
        f"planning-route-{suffix}",
    )
    assert route.status_code == 200, route.text
    shipment = command(
        client,
        ops,
        "CreateShipment",
        {
            "code": f"PLANNING-SHIPMENT-{suffix}",
            "shipper_party_id": shipper_id,
            "consignee_party_id": consignee_id,
            "origin_location_id": origin_id,
            "destination_location_id": destination_id,
            "route_definition_id": route.json()["result"]["id"],
        },
        f"planning-shipment-{suffix}",
    )
    assert shipment.status_code == 200, shipment.text
    shipment_id = shipment.json()["result"]["id"]

    project = command(
        client,
        ops,
        "CreatePlanningProject",
        {
            "name": f"Shipment workflow {suffix}",
            "start": "2026-08-01",
            "end": "2026-08-31",
        },
        f"planning-shipment-project-{suffix}",
    )
    assert project.status_code == 200, project.text
    project_id = project.json()["result"]["id"]
    schedule = client.get(f"/api/planning/projects/{project_id}/schedule", headers=ops)
    assert schedule.status_code == 200, schedule.text

    linked = client.post(
        f"/api/planning/projects/{project_id}/links",
        headers={
            **ops,
            "Idempotency-Key": f"planning-shipment-link-{suffix}",
            "If-Match": schedule.headers["ETag"],
        },
        json={
            "scope_type": "project",
            "relationship": "moves",
            "target": {"kind": "shipment", "id": shipment_id},
        },
    )
    assert linked.status_code == 200, linked.text
    assert linked.json()["target"] == {
        "kind": "shipment",
        "id": shipment_id,
        "resolver": "shipment.provider",
        "resolver_version": "1",
    }
    assert linked.json()["resolution"] == {
        "status": "ready",
        "display_label": f"PLANNING-SHIPMENT-{suffix}",
        "status_summary": "Shipment is draft.",
        "checked_at": linked.json()["resolution"]["checked_at"],
        "open_path": f"/?view=shipments&shipment_id={shipment_id}",
    }

    disabled = client.post("/api/modules/shipments.core/disable", headers=admin)
    assert disabled.status_code == 200, disabled.text
    try:
        unavailable = client.get(
            f"/api/planning/projects/{project_id}/schedule",
            headers=ops,
        )
        assert unavailable.status_code == 200, unavailable.text
        assert unavailable.json()["links"][0]["resolution"]["status"] == "unavailable"
        assert unavailable.json()["links"][0]["resolution"]["display_label"] is None
    finally:
        enabled = client.post("/api/modules/shipments.core/enable", headers=admin)
        assert enabled.status_code == 200, enabled.text


def _party(
    client: TestClient,
    headers: dict[str, str],
    display_name: str,
    key: str,
) -> str:
    created = command(
        client,
        headers,
        "CreateContact",
        {"party_type": "organization", "display_name": display_name},
        key,
    )
    assert created.status_code == 200, created.text
    return str(created.json()["result"]["contact_id"])


def _location(
    client: TestClient,
    headers: dict[str, str],
    code: str,
    name: str,
    country_code: str,
    key: str,
) -> str:
    created = command(
        client,
        headers,
        "CreateLocationDefinition",
        {
            "code": code,
            "canonical_name": name,
            "location_type": "port",
            "country_code": country_code,
        },
        key,
    )
    assert created.status_code == 200, created.text
    return str(created.json()["result"]["id"])

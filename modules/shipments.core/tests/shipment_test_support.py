from __future__ import annotations

from starlette.testclient import TestClient

from tests.helpers import command


def install_shipment_stack(client: TestClient, admin_headers: dict[str, str]) -> None:
    for module_name in ("contacts.core", "locations.core", "routes.core", "shipments.core"):
        response = client.post(f"/api/modules/{module_name}/install", headers=admin_headers)
        assert response.status_code == 200, response.text


def create_party(
    client: TestClient,
    headers: dict[str, str],
    display_name: str,
    key: str,
) -> str:
    response = command(client, headers, "CreateContact", {
        "party_type": "organization",
        "display_name": display_name,
    }, key)
    assert response.status_code == 200, response.text
    return str(response.json()["result"]["contact_id"])


def create_location(
    client: TestClient,
    headers: dict[str, str],
    code: str,
    name: str,
    country_code: str,
    key: str,
) -> str:
    response = command(client, headers, "CreateLocationDefinition", {
        "code": code,
        "canonical_name": name,
        "location_type": "port",
        "country_code": country_code,
    }, key)
    assert response.status_code == 200, response.text
    return str(response.json()["result"]["id"])


def create_route(
    client: TestClient,
    headers: dict[str, str],
    code: str,
    name: str,
    origin_location_id: str,
    destination_location_id: str,
    key: str,
) -> str:
    response = command(client, headers, "CreateRouteDefinition", {
        "code": code,
        "canonical_name": name,
        "mode_hint": "sea",
        "origin_location_id": origin_location_id,
        "waypoint_location_ids": [],
        "destination_location_id": destination_location_id,
    }, key)
    assert response.status_code == 200, response.text
    return str(response.json()["result"]["id"])


def shipment_payload(
    code: str,
    shipper_party_id: str,
    consignee_party_id: str,
    origin_location_id: str,
    destination_location_id: str,
    route_definition_id: str | None,
) -> dict[str, object]:
    return {
        "code": code,
        "shipper_party_id": shipper_party_id,
        "consignee_party_id": consignee_party_id,
        "origin_location_id": origin_location_id,
        "destination_location_id": destination_location_id,
        "route_definition_id": route_definition_id,
        "planned_departure_on": "2026-08-01",
        "planned_arrival_on": "2026-08-21",
    }


__all__ = [
    "create_location",
    "create_party",
    "create_route",
    "install_shipment_stack",
    "shipment_payload",
]

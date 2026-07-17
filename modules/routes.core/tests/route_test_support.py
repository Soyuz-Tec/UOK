from __future__ import annotations

from starlette.testclient import TestClient

from tests.helpers import command


def install_route_stack(client: TestClient, admin_headers: dict[str, str]) -> None:
    assert client.post("/api/modules/locations.core/install", headers=admin_headers).status_code == 200
    response = client.post("/api/modules/routes.core/install", headers=admin_headers)
    assert response.status_code == 200, response.text


def create_location(
    client: TestClient,
    headers: dict[str, str],
    code: str,
    name: str,
    location_type: str = "port",
    country_code: str = "NG",
) -> dict[str, object]:
    response = command(client, headers, "CreateLocationDefinition", {
        "code": code,
        "canonical_name": name,
        "location_type": location_type,
        "country_code": country_code,
    }, f"create-location-{code}")
    assert response.status_code == 200, response.text
    return response.json()["result"]


def create_route(
    client: TestClient,
    headers: dict[str, str],
    code: str,
    name: str,
    location_ids: list[str],
    key: str,
    mode_hint: str | None = "multimodal",
):
    return command(client, headers, "CreateRouteDefinition", {
        "code": code,
        "canonical_name": name,
        "mode_hint": mode_hint,
        "origin_location_id": location_ids[0],
        "waypoint_location_ids": location_ids[1:-1],
        "destination_location_id": location_ids[-1],
    }, key)

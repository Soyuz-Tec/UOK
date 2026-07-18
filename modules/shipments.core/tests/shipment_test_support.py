from __future__ import annotations

from starlette.testclient import TestClient

from tests.helpers import command
from uok.host.database import SessionLocal
from uok.host.security import issue_token
from uok.kernel.security import Actor
from uok.kernel_models import Membership, Organization, User


def install_shipment_stack(client: TestClient, admin_headers: dict[str, str]) -> None:
    for module_name in (
        "compliance.core",
        "contacts.core",
        "locations.core",
        "routes.core",
        "shipments.core",
    ):
        response = client.post(f"/api/modules/{module_name}/install", headers=admin_headers)
        assert response.status_code == 200, response.text


def create_compliance_document_type(
    client: TestClient,
    headers: dict[str, str],
    code: str,
    name: str,
    key: str,
) -> dict[str, object]:
    response = command(client, headers, "CreateComplianceDocumentType", {
        "code": code,
        "canonical_name": name,
        "category": "Trade operations",
    }, key)
    assert response.status_code == 200, response.text
    return response.json()["result"]


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


def create_requirement_shipment(
    client: TestClient,
    headers: dict[str, str],
    suffix: str,
) -> str:
    shipper_id = create_party(
        client,
        headers,
        f"Requirement Shipper {suffix}",
        f"requirement-shipper-{suffix}",
    )
    consignee_id = create_party(
        client,
        headers,
        f"Requirement Consignee {suffix}",
        f"requirement-consignee-{suffix}",
    )
    origin_id = create_location(
        client,
        headers,
        f"REQ-ORIGIN-{suffix}",
        f"Requirement Origin {suffix}",
        "NG",
        f"requirement-origin-{suffix}",
    )
    destination_id = create_location(
        client,
        headers,
        f"REQ-DEST-{suffix}",
        f"Requirement Destination {suffix}",
        "IN",
        f"requirement-destination-{suffix}",
    )
    route_id = create_route(
        client,
        headers,
        f"REQ-ROUTE-{suffix}",
        f"Requirement Route {suffix}",
        origin_id,
        destination_id,
        f"requirement-route-{suffix}",
    )
    response = command(
        client,
        headers,
        "CreateShipment",
        shipment_payload(
            f"REQ-SHIPMENT-{suffix}",
            shipper_id,
            consignee_id,
            origin_id,
            destination_id,
            route_id,
        ),
        f"requirement-shipment-{suffix}",
    )
    assert response.status_code == 200, response.text
    return str(response.json()["result"]["id"])


def get_document_requirements(
    client: TestClient,
    headers: dict[str, str],
    shipment_id: str,
) -> dict[str, object]:
    response = client.get(
        f"/api/shipments/records/{shipment_id}/document-requirements",
        headers=headers,
    )
    assert response.status_code == 200, response.text
    return response.json()


def get_document_instances(
    client: TestClient,
    headers: dict[str, str],
    shipment_id: str,
) -> list[dict[str, object]]:
    response = client.get(
        f"/api/shipments/records/{shipment_id}/document-instances",
        headers=headers,
    )
    assert response.status_code == 200, response.text
    return response.json()


def other_shipment_tenant_headers(suffix: str) -> dict[str, str]:
    with SessionLocal() as db:
        organization = Organization(name=f"Shipment requirement tenant {suffix}")
        user = User(
            username=f"shipment-requirement-{suffix.lower()}@example.test",
            password_hash="not-used",
            display_name="Shipment requirement tenant admin",
        )
        db.add_all((organization, user))
        db.flush()
        db.add(Membership(
            organization_id=organization.id,
            user_id=user.id,
            role="platform_admin",
        ))
        db.commit()
        actor = Actor(
            user.id,
            user.username,
            organization.id,
            "platform_admin",
        )
    return {"Authorization": f"Bearer {issue_token(actor)}"}


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
    "create_compliance_document_type",
    "create_location",
    "create_party",
    "create_requirement_shipment",
    "create_route",
    "get_document_instances",
    "get_document_requirements",
    "install_shipment_stack",
    "other_shipment_tenant_headers",
    "shipment_payload",
]

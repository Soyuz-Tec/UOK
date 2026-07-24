from __future__ import annotations

from starlette.testclient import TestClient

from tests.helpers import command
from uok.host.database import SessionLocal
from uok.host.security import issue_token
from uok.kernel.security import Actor
from uok.kernel_models import Membership, Organization, User


def install_intelligence_stack(
    client: TestClient,
    admin_headers: dict[str, str],
) -> None:
    for module_name in (
        "compliance.core",
        "contacts.core",
        "locations.core",
        "routes.core",
        "shipments.core",
        "intelligence.core",
    ):
        response = client.post(
            f"/api/modules/{module_name}/install",
            headers=admin_headers,
        )
        assert response.status_code == 200, response.text


def create_shipment(
    client: TestClient,
    headers: dict[str, str],
    suffix: str,
) -> str:
    shipper_id = _create_party(
        client,
        headers,
        f"Readiness Shipper {suffix}",
        f"readiness-shipper-{suffix}",
    )
    consignee_id = _create_party(
        client,
        headers,
        f"Readiness Consignee {suffix}",
        f"readiness-consignee-{suffix}",
    )
    origin_id = _create_location(
        client,
        headers,
        f"READY-ORIGIN-{suffix}",
        f"Readiness Origin {suffix}",
        "NG",
        f"readiness-origin-{suffix}",
    )
    destination_id = _create_location(
        client,
        headers,
        f"READY-DEST-{suffix}",
        f"Readiness Destination {suffix}",
        "IN",
        f"readiness-destination-{suffix}",
    )
    route_id = _create_route(
        client,
        headers,
        f"READY-ROUTE-{suffix}",
        f"Readiness Route {suffix}",
        origin_id,
        destination_id,
        f"readiness-route-{suffix}",
    )
    response = command(
        client,
        headers,
        "CreateShipment",
        {
            "code": f"READY-SHIPMENT-{suffix}",
            "shipper_party_id": shipper_id,
            "consignee_party_id": consignee_id,
            "origin_location_id": origin_id,
            "destination_location_id": destination_id,
            "route_definition_id": route_id,
            "planned_departure_on": "2026-08-01",
            "planned_arrival_on": "2026-08-21",
        },
        f"readiness-shipment-{suffix}",
    )
    assert response.status_code == 200, response.text
    return str(response.json()["result"]["id"])


def create_document_type(
    client: TestClient,
    headers: dict[str, str],
    suffix: str,
) -> str:
    response = command(
        client,
        headers,
        "CreateComplianceDocumentType",
        {
            "code": f"READINESS-TYPE-{suffix}",
            "canonical_name": f"Readiness Type {suffix}",
            "category": "Trade operations",
        },
        f"readiness-type-{suffix}",
    )
    assert response.status_code == 200, response.text
    return str(response.json()["result"]["id"])


def other_tenant_headers(suffix: str) -> dict[str, str]:
    with SessionLocal() as db:
        organization = Organization(name=f"Intelligence tenant {suffix}")
        user = User(
            username=f"intelligence-{suffix.lower()}@example.test",
            password_hash="not-used",
            display_name="Intelligence tenant admin",
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


def _create_party(
    client: TestClient,
    headers: dict[str, str],
    display_name: str,
    key: str,
) -> str:
    response = command(
        client,
        headers,
        "CreateContact",
        {"party_type": "organization", "display_name": display_name},
        key,
    )
    assert response.status_code == 200, response.text
    return str(response.json()["result"]["contact_id"])


def _create_location(
    client: TestClient,
    headers: dict[str, str],
    code: str,
    name: str,
    country_code: str,
    key: str,
) -> str:
    response = command(
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
    assert response.status_code == 200, response.text
    return str(response.json()["result"]["id"])


def _create_route(
    client: TestClient,
    headers: dict[str, str],
    code: str,
    name: str,
    origin_id: str,
    destination_id: str,
    key: str,
) -> str:
    response = command(
        client,
        headers,
        "CreateRouteDefinition",
        {
            "code": code,
            "canonical_name": name,
            "mode_hint": "sea",
            "origin_location_id": origin_id,
            "waypoint_location_ids": [],
            "destination_location_id": destination_id,
        },
        key,
    )
    assert response.status_code == 200, response.text
    return str(response.json()["result"]["id"])


__all__ = [
    "create_document_type",
    "create_shipment",
    "install_intelligence_stack",
    "other_tenant_headers",
]

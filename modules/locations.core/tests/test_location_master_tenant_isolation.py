from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.host.database import SessionLocal
from uok.host.security import issue_token
from uok.kernel.security import Actor
from uok.kernel_models import Membership, Organization, User


def test_location_codes_and_all_reads_and_mutations_are_tenant_scoped(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/locations.core/install", headers=admin).status_code == 200
    suffix = uuid4().hex[:8].upper()
    other_headers = _other_tenant_headers(suffix)
    assert client.post("/api/modules/locations.core/install", headers=other_headers).status_code == 200
    shared_code = f"PORT-SHARED-{suffix}"

    local = command(client, ops, "CreateLocationDefinition", {
        "code": shared_code,
        "canonical_name": f"Local Port {suffix}",
        "location_type": "port",
        "country_code": "NG",
    }, f"local-location-{suffix}")
    remote = command(client, other_headers, "CreateLocationDefinition", {
        "code": shared_code,
        "canonical_name": f"Other Tenant Port {suffix}",
        "location_type": "port",
        "country_code": "GH",
    }, f"remote-location-{suffix}")
    assert local.status_code == 200, local.text
    assert remote.status_code == 200, remote.text
    local_id = local.json()["result"]["id"]
    remote_id = remote.json()["result"]["id"]
    assert local_id != remote_id

    assert client.get(f"/api/locations/definitions/{remote_id}", headers=ops).status_code == 404
    assert client.get(f"/api/locations/definitions/{remote_id}/name-history", headers=ops).status_code == 404
    assert client.get(f"/api/locations/definitions/{local_id}", headers=other_headers).status_code == 404
    assert client.get(f"/api/locations/definitions/{local_id}/name-history", headers=other_headers).status_code == 404
    assert client.get(f"/api/locations/definitions/{remote_id}", headers=other_headers).status_code == 200

    for command_name in ("UpdateLocationDefinition", "ArchiveLocationDefinition", "RestoreLocationDefinition"):
        payload: dict[str, object] = {"location_definition_id": remote_id, "expected_version": 1}
        if command_name == "UpdateLocationDefinition":
            payload["canonical_name"] = "Forbidden cross-tenant update"
        denied = command(client, ops, command_name, payload, f"cross-tenant-{command_name}-{suffix}")
        assert denied.status_code == 400, denied.text
        assert "location definition not found" in denied.text

    remote_detail = client.get(f"/api/locations/definitions/{remote_id}", headers=other_headers)
    assert remote_detail.status_code == 200, remote_detail.text
    assert remote_detail.json()["canonical_name"] == f"Other Tenant Port {suffix}"
    assert remote_detail.json()["status"] == "active"
    assert remote_detail.json()["version"] == 1


def _other_tenant_headers(suffix: str) -> dict[str, str]:
    with SessionLocal() as db:
        organization = Organization(name=f"Location Master tenant {suffix}")
        user = User(
            username=f"location-master-{suffix.lower()}@example.test",
            password_hash="not-used",
            display_name="Location Master tenant admin",
        )
        db.add_all((organization, user))
        db.flush()
        db.add(Membership(organization_id=organization.id, user_id=user.id, role="platform_admin"))
        db.commit()
        actor = Actor(user.id, user.username, organization.id, "platform_admin")
    return {"Authorization": f"Bearer {issue_token(actor)}"}

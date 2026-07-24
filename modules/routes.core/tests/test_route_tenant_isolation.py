from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.host.database import SessionLocal
from uok.host.security import issue_token
from uok.kernel.security import Actor
from uok.kernel_models import Membership, Organization, User

from route_test_support import create_location, create_route, install_route_stack


def test_route_reads_writes_codes_and_location_references_are_tenant_scoped(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    install_route_stack(client, admin)
    suffix = uuid4().hex[:8].upper()
    other = _other_tenant_headers(suffix)
    install_route_stack(client, other)
    local_locations = [
        create_location(client, ops, f"LOCAL-{label}-{suffix}", f"Local {label} {suffix}")
        for label in ("ORIGIN", "DEST")
    ]
    remote_locations = [
        create_location(client, other, f"REMOTE-{label}-{suffix}", f"Remote {label} {suffix}", country_code="GH")
        for label in ("ORIGIN", "DEST")
    ]
    local_ids = [str(row["id"]) for row in local_locations]
    remote_ids = [str(row["id"]) for row in remote_locations]
    shared_code = f"SHARED-ROUTE-{suffix}"
    local = create_route(client, ops, shared_code, f"Local Route {suffix}", local_ids, f"local-route-{suffix}")
    remote = create_route(client, other, shared_code, f"Remote Route {suffix}", remote_ids, f"remote-route-{suffix}")
    assert local.status_code == 200, local.text
    assert remote.status_code == 200, remote.text
    local_id = local.json()["result"]["id"]
    remote_id = remote.json()["result"]["id"]
    assert local_id != remote_id

    assert client.get(f"/api/routes/definitions/{remote_id}", headers=ops).status_code == 404
    assert client.get(f"/api/routes/definitions/{local_id}", headers=other).status_code == 404
    assert client.get(f"/api/routes/definitions/{remote_id}/name-history", headers=ops).status_code == 404
    local_options = client.get("/api/routes/location-options", headers=ops).json()
    assert set(remote_ids).isdisjoint({row["location_definition_id"] for row in local_options})

    foreign_location = create_route(
        client,
        ops,
        f"FOREIGN-LOCATION-{suffix}",
        f"Foreign Location {suffix}",
        [local_ids[0], remote_ids[1]],
        f"foreign-location-{suffix}",
    )
    assert foreign_location.status_code == 400, foreign_location.text
    assert "missing" in foreign_location.text

    for command_name in ("UpdateRouteDefinition", "ArchiveRouteDefinition", "RestoreRouteDefinition"):
        payload: dict[str, object] = {"route_definition_id": remote_id, "expected_version": 1}
        if command_name == "UpdateRouteDefinition":
            payload["canonical_name"] = "Forbidden cross-tenant update"
        denied = command(client, ops, command_name, payload, f"cross-tenant-{command_name}-{suffix}")
        assert denied.status_code == 400, denied.text
        assert "route definition not found" in denied.text

    remote_detail = client.get(f"/api/routes/definitions/{remote_id}", headers=other)
    assert remote_detail.status_code == 200, remote_detail.text
    assert remote_detail.json()["canonical_name"] == f"Remote Route {suffix}"
    assert remote_detail.json()["version"] == 1


def _other_tenant_headers(suffix: str) -> dict[str, str]:
    with SessionLocal() as db:
        organization = Organization(name=f"Route Master tenant {suffix}")
        user = User(
            username=f"route-master-{suffix.lower()}@example.test",
            password_hash="not-used",
            display_name="Route Master tenant admin",
        )
        db.add_all((organization, user))
        db.flush()
        db.add(Membership(organization_id=organization.id, user_id=user.id, role="platform_admin"))
        db.commit()
        actor = Actor(user.id, user.username, organization.id, "platform_admin")
    return {"Authorization": f"Bearer {issue_token(actor)}"}

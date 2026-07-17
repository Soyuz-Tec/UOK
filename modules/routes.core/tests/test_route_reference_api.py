from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.host.database import SessionLocal
from uok.host.security import parse_token
from uok.kernel.security import Actor
from uok_routes_core.public_api import resolve_route_reference

from route_test_support import create_location, create_route, install_route_stack


def test_route_reference_resolver_is_tenant_permission_and_lifecycle_aware(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    install_route_stack(client, admin)
    suffix = uuid4().hex[:8].upper()
    locations = [
        create_location(client, ops, f"ROUTE-REF-{index}-{suffix}", f"Route Reference {index} {suffix}")
        for index in (1, 2)
    ]
    created = create_route(
        client,
        ops,
        f"ROUTE-REFERENCE-{suffix}",
        f"Route Reference {suffix}",
        [str(row["id"]) for row in locations],
        f"route-reference-{suffix}",
        "sea",
    )
    assert created.status_code == 200, created.text
    route = created.json()["result"]
    actor = parse_token(ops["Authorization"].split(" ", 1)[1])

    with SessionLocal() as db:
        ready = resolve_route_reference(db, actor, route["id"])
        assert ready.status == "ready"
        assert ready.code == f"ROUTE-REFERENCE-{suffix}"
        assert resolve_route_reference(db, actor, "missing-route").status == "missing"
        denied_actor = Actor(actor.user_id, actor.username, actor.organization_id, "registered_user")
        denied = resolve_route_reference(db, denied_actor, route["id"])
        assert denied.status == "denied"
        assert denied.canonical_name is None

    archived = command(client, ops, "ArchiveRouteDefinition", {
        "route_definition_id": route["id"],
        "expected_version": 1,
    }, f"archive-route-reference-{suffix}")
    assert archived.status_code == 200, archived.text
    with SessionLocal() as db:
        unavailable = resolve_route_reference(db, actor, route["id"])
        assert unavailable.status == "unavailable"
        assert unavailable.canonical_name == f"Route Reference {suffix}"

    assert client.post("/api/modules/routes.core/disable", headers=admin).status_code == 200
    try:
        with SessionLocal() as db:
            provider_unavailable = resolve_route_reference(db, actor, route["id"])
            assert provider_unavailable.status == "unavailable"
            assert provider_unavailable.canonical_name is None
    finally:
        assert client.post("/api/modules/routes.core/enable", headers=admin).status_code == 200

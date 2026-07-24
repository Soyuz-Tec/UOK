from __future__ import annotations

from dataclasses import FrozenInstanceError
from uuid import uuid4

import pytest
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.host.database import SessionLocal
from uok.host.security import parse_token
from uok.kernel.security import Actor
from uok_routes_core.public_api import (
    RoutePathReferenceDTO,
    resolve_route_path_references,
    resolve_route_reference,
)

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


def test_route_path_resolver_preserves_requested_order_and_returns_immutable_paths(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    install_route_stack(client, admin)
    suffix = uuid4().hex[:8].upper()
    locations = [
        create_location(client, ops, f"PATH-REF-{index}-{suffix}", f"Path Reference {index} {suffix}")
        for index in (1, 2, 3)
    ]
    location_ids = [str(row["id"]) for row in locations]
    first = create_route(
        client,
        ops,
        f"PATH-REFERENCE-A-{suffix}",
        f"A Path Reference {suffix}",
        location_ids,
        f"path-reference-a-{suffix}",
        "sea",
    ).json()["result"]
    second = create_route(
        client,
        ops,
        f"PATH-REFERENCE-B-{suffix}",
        f"B Path Reference {suffix}",
        [location_ids[0], location_ids[-1]],
        f"path-reference-b-{suffix}",
        "road",
    ).json()["result"]
    actor = parse_token(ops["Authorization"].split(" ", 1)[1])

    with SessionLocal() as db:
        requested = resolve_route_path_references(db, actor, [second["id"], "missing-route", first["id"]])
        assert [value.route_definition_id for value in requested] == [
            second["id"], "missing-route", first["id"],
        ]
        assert requested[0].ordered_location_ids == (location_ids[0], location_ids[-1])
        assert requested[1].status == "missing"
        assert requested[1].ordered_location_ids == ()
        assert requested[2].ordered_location_ids == tuple(location_ids)
        assert isinstance(requested[0], RoutePathReferenceDTO)
        with pytest.raises(FrozenInstanceError):
            requested[0].code = "CHANGED"  # type: ignore[misc]

        choices = resolve_route_path_references(db, actor)
        choice_ids = [value.route_definition_id for value in choices]
        assert first["id"] in choice_ids
        assert second["id"] in choice_ids

        denied_actor = Actor(actor.user_id, actor.username, actor.organization_id, "registered_user")
        denied = resolve_route_path_references(db, denied_actor, [first["id"]])
        assert denied[0].status == "denied"
        assert denied[0].ordered_location_ids == ()
        with pytest.raises(PermissionError, match="routes.read"):
            resolve_route_path_references(db, denied_actor)

    archived = command(client, ops, "ArchiveRouteDefinition", {
        "route_definition_id": first["id"],
        "expected_version": 1,
    }, f"archive-path-reference-{suffix}")
    assert archived.status_code == 200, archived.text
    with SessionLocal() as db:
        retained = resolve_route_path_references(db, actor, [first["id"]])[0]
        assert retained.status == "unavailable"
        assert retained.ordered_location_ids == tuple(location_ids)
        assert first["id"] not in {
            value.route_definition_id for value in resolve_route_path_references(db, actor)
        }

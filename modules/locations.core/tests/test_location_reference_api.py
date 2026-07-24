from __future__ import annotations

from dataclasses import FrozenInstanceError
from uuid import uuid4

import pytest
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.host.database import SessionLocal
from uok.host.security import parse_token
from uok.kernel.security import Actor
from uok_locations_core.public_api import resolve_location_references


def test_location_reference_batch_is_frozen_ordered_tenant_scoped_and_lifecycle_aware(
    client: TestClient,
) -> None:
    admin_headers = auth(client, "admin", "admin")
    ops_headers = auth(client, "ops", "ops123")
    assert client.post("/api/modules/locations.core/install", headers=admin_headers).status_code == 200
    suffix = uuid4().hex[:8].upper()
    first = _create_location(client, ops_headers, f"REF-A-{suffix}", f"Reference A {suffix}")
    second = _create_location(client, ops_headers, f"REF-B-{suffix}", f"Reference B {suffix}")
    archived = command(client, ops_headers, "ArchiveLocationDefinition", {
        "location_definition_id": second["id"],
        "expected_version": 1,
    }, f"archive-reference-{suffix}")
    assert archived.status_code == 200, archived.text
    actor = parse_token(ops_headers["Authorization"].split(" ", 1)[1])

    with SessionLocal() as db:
        values = resolve_location_references(db, actor, [second["id"], "missing-location", first["id"]])
        assert [value.location_definition_id for value in values] == [
            second["id"],
            "missing-location",
            first["id"],
        ]
        assert [value.status for value in values] == ["unavailable", "missing", "ready"]
        options = resolve_location_references(db, actor)
        assert first["id"] in {value.location_definition_id for value in options}
        assert second["id"] not in {value.location_definition_id for value in options}
        with pytest.raises(FrozenInstanceError):
            values[0].canonical_name = "Changed"  # type: ignore[misc]

        denied_actor = Actor(actor.user_id, actor.username, actor.organization_id, "registered_user")
        denied = resolve_location_references(db, denied_actor, [first["id"]])
        assert denied[0].status == "denied"
        assert denied[0].canonical_name is None
        with pytest.raises(PermissionError, match="locations.read"):
            resolve_location_references(db, denied_actor)


def test_location_reference_batch_reports_disabled_provider_without_leaking_values(client: TestClient) -> None:
    admin_headers = auth(client, "admin", "admin")
    ops_headers = auth(client, "ops", "ops123")
    assert client.post("/api/modules/locations.core/install", headers=admin_headers).status_code == 200
    suffix = uuid4().hex[:8].upper()
    location = _create_location(client, ops_headers, f"REF-DISABLED-{suffix}", f"Disabled {suffix}")
    actor = parse_token(ops_headers["Authorization"].split(" ", 1)[1])
    assert client.post("/api/modules/locations.core/disable", headers=admin_headers).status_code == 200
    try:
        with SessionLocal() as db:
            resolution = resolve_location_references(db, actor, [location["id"]])[0]
            assert resolution.status == "unavailable"
            assert resolution.canonical_name is None
            with pytest.raises(ValueError, match="not operational"):
                resolve_location_references(db, actor)
    finally:
        assert client.post("/api/modules/locations.core/enable", headers=admin_headers).status_code == 200


def _create_location(
    client: TestClient,
    headers: dict[str, str],
    code: str,
    name: str,
) -> dict[str, object]:
    response = command(client, headers, "CreateLocationDefinition", {
        "code": code,
        "canonical_name": name,
        "location_type": "port",
        "country_code": "NG",
    }, f"create-location-{code}")
    assert response.status_code == 200, response.text
    return response.json()["result"]

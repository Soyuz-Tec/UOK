from __future__ import annotations

from uuid import uuid4

from sqlalchemy import select
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.host.database import SessionLocal
from uok.kernel_models import EventRecord
from uok.util import loads


def test_location_definition_lifecycle_is_idempotent_versioned_and_audited(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")
    assert client.post("/api/modules/locations.core/install", headers=admin).status_code == 200
    suffix = uuid4().hex[:8].upper()
    create_payload = {
        "code": f" ng_apapa_{suffix} ",
        "canonical_name": f"Apapa Port {suffix}",
        "location_type": "port",
        "country_code": "ng",
    }

    created = command(client, ops, "CreateLocationDefinition", create_payload, f"location-create-{suffix}")
    assert created.status_code == 200, created.text
    created_body = created.json()
    location = created_body["result"]
    assert location["code"] == f"NG-APAPA-{suffix}"
    assert location["country_code"] == "NG"
    assert location["version"] == 1
    assert location["correlation_id"] == created_body["command_id"]
    location_id = location["id"]

    replay = command(client, ops, "CreateLocationDefinition", create_payload, f"location-create-{suffix}")
    assert replay.status_code == 200, replay.text
    assert replay.json()["idempotent"] is True
    assert replay.json()["result"] == location

    duplicate = command(client, ops, "CreateLocationDefinition", create_payload, f"location-duplicate-{suffix}")
    assert duplicate.status_code == 400, duplicate.text
    denied = command(client, viewer, "CreateLocationDefinition", create_payload, f"location-denied-{suffix}")
    assert denied.status_code == 403, denied.text

    detail = client.get(f"/api/locations/definitions/{location_id}", headers=viewer)
    assert detail.status_code == 200, detail.text
    assert detail.json()["id"] == location_id

    updated = command(client, ops, "UpdateLocationDefinition", {
        "location_definition_id": location_id,
        "expected_version": 1,
        "canonical_name": f"Port of Apapa {suffix}",
        "location_type": "port",
        "country_code": "NG",
        "reason": "Align canonical operations name",
    }, f"location-update-name-{suffix}")
    assert updated.status_code == 200, updated.text
    updated_body = updated.json()
    assert updated_body["result"]["version"] == 2
    assert updated_body["result"]["correlation_id"] == updated_body["command_id"]

    history = client.get(f"/api/locations/definitions/{location_id}/name-history", headers=viewer)
    assert history.status_code == 200, history.text
    assert history.json() == [{
        "id": history.json()[0]["id"],
        "location_definition_id": location_id,
        "previous_name": f"Apapa Port {suffix}",
        "new_name": f"Port of Apapa {suffix}",
        "reason": "Align canonical operations name",
        "changed_by_user_id": updated_body["result"]["updated_by_user_id"],
        "changed_at": history.json()[0]["changed_at"],
    }]

    changed_without_rename = command(client, ops, "UpdateLocationDefinition", {
        "location_definition_id": location_id,
        "expected_version": 2,
        "canonical_name": f"Port of Apapa {suffix}",
        "location_type": "warehouse",
    }, f"location-update-type-{suffix}")
    assert changed_without_rename.status_code == 200, changed_without_rename.text
    assert changed_without_rename.json()["result"]["version"] == 3
    assert changed_without_rename.json()["result"]["location_type"] == "warehouse"
    assert len(client.get(f"/api/locations/definitions/{location_id}/name-history", headers=viewer).json()) == 1

    stale = command(client, ops, "ArchiveLocationDefinition", {
        "location_definition_id": location_id,
        "expected_version": 2,
    }, f"location-stale-{suffix}")
    assert stale.status_code == 400, stale.text
    assert "current version 3" in stale.text

    archived = command(client, ops, "ArchiveLocationDefinition", {
        "location_definition_id": location_id,
        "expected_version": 3,
    }, f"location-archive-{suffix}")
    assert archived.status_code == 200, archived.text
    assert archived.json()["result"]["status"] == "archived"
    assert archived.json()["result"]["version"] == 4
    assert all(row["id"] != location_id for row in client.get("/api/locations/definitions", headers=viewer).json())
    archived_rows = client.get("/api/locations/definitions?include_archived=true", headers=viewer)
    assert any(row["id"] == location_id and row["status"] == "archived" for row in archived_rows.json())
    assert client.get(f"/api/locations/definitions/{location_id}", headers=viewer).status_code == 200
    assert client.get(f"/api/locations/definitions/{location_id}/name-history", headers=viewer).status_code == 200

    restored = command(client, ops, "RestoreLocationDefinition", {
        "location_definition_id": location_id,
        "expected_version": 4,
    }, f"location-restore-{suffix}")
    assert restored.status_code == 200, restored.text
    assert restored.json()["result"]["status"] == "active"
    assert restored.json()["result"]["version"] == 5

    command_ids = {
        created_body["command_id"],
        updated_body["command_id"],
        changed_without_rename.json()["command_id"],
        archived.json()["command_id"],
        restored.json()["command_id"],
    }
    with SessionLocal() as db:
        events = db.scalars(select(EventRecord).where(
            EventRecord.object_type == "LocationDefinition",
            EventRecord.object_id == location_id,
        )).all()
        assert {loads(event.payload_json)["correlation_id"] for event in events} == command_ids
        assert {event.event_type for event in events} == {
            "LocationDefinitionCreated",
            "LocationDefinitionUpdated",
            "LocationDefinitionArchived",
            "LocationDefinitionRestored",
        }

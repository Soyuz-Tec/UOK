from __future__ import annotations

from uuid import uuid4

from sqlalchemy import select
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.host.database import SessionLocal
from uok.kernel_models import EventRecord
from uok.util import loads


def test_product_definition_lifecycle_is_idempotent_versioned_and_audited(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")
    assert client.post("/api/modules/product.master/install", headers=admin).status_code == 200
    suffix = uuid4().hex[:8].upper()
    create_payload = {
        "code": f" rcn_{suffix} ",
        "canonical_name": f"Raw Cashew Nut {suffix}",
        "category": "Commodity",
        "grade": "Supplier Grade A",
        "specification": "Contract specification",
        "base_unit_code": "kg",
    }

    created = command(client, ops, "CreateProductDefinition", create_payload, f"product-create-{suffix}")
    assert created.status_code == 200, created.text
    created_body = created.json()
    product = created_body["result"]
    assert product["code"] == f"RCN-{suffix}"
    assert product["version"] == 1
    assert product["correlation_id"] == created_body["command_id"]
    product_id = product["id"]

    replay = command(client, ops, "CreateProductDefinition", create_payload, f"product-create-{suffix}")
    assert replay.status_code == 200, replay.text
    assert replay.json()["idempotent"] is True
    assert replay.json()["result"] == product

    duplicate = command(client, ops, "CreateProductDefinition", create_payload, f"product-duplicate-{suffix}")
    assert duplicate.status_code == 400, duplicate.text
    denied = command(client, viewer, "CreateProductDefinition", create_payload, f"product-denied-{suffix}")
    assert denied.status_code == 403, denied.text

    detail = client.get(f"/api/products/definitions/{product_id}", headers=viewer)
    assert detail.status_code == 200, detail.text
    assert detail.json()["id"] == product_id

    updated = command(client, ops, "UpdateProductDefinition", {
        "product_definition_id": product_id,
        "expected_version": 1,
        "canonical_name": f"RCN Supplier Grade A {suffix}",
        "category": "Commodity",
        "grade": "Supplier Grade A",
        "reason": "Align canonical trading name",
    }, f"product-update-name-{suffix}")
    assert updated.status_code == 200, updated.text
    updated_body = updated.json()
    assert updated_body["result"]["version"] == 2
    assert updated_body["result"]["correlation_id"] == updated_body["command_id"]

    history = client.get(f"/api/products/definitions/{product_id}/name-history", headers=viewer)
    assert history.status_code == 200, history.text
    assert history.json() == [{
        "id": history.json()[0]["id"],
        "product_definition_id": product_id,
        "previous_name": f"Raw Cashew Nut {suffix}",
        "new_name": f"RCN Supplier Grade A {suffix}",
        "reason": "Align canonical trading name",
        "changed_by_user_id": updated_body["result"]["updated_by_user_id"],
        "changed_at": history.json()[0]["changed_at"],
    }]

    changed_without_rename = command(client, ops, "UpdateProductDefinition", {
        "product_definition_id": product_id,
        "expected_version": 2,
        "canonical_name": f"RCN Supplier Grade A {suffix}",
        "specification": "Updated export grade",
    }, f"product-update-spec-{suffix}")
    assert changed_without_rename.status_code == 200, changed_without_rename.text
    assert changed_without_rename.json()["result"]["version"] == 3
    assert len(client.get(f"/api/products/definitions/{product_id}/name-history", headers=viewer).json()) == 1

    stale = command(client, ops, "ArchiveProductDefinition", {
        "product_definition_id": product_id,
        "expected_version": 2,
    }, f"product-stale-{suffix}")
    assert stale.status_code == 400, stale.text
    assert "current version 3" in stale.text

    archived = command(client, ops, "ArchiveProductDefinition", {
        "product_definition_id": product_id,
        "expected_version": 3,
    }, f"product-archive-{suffix}")
    assert archived.status_code == 200, archived.text
    assert archived.json()["result"]["status"] == "archived"
    assert archived.json()["result"]["version"] == 4
    assert all(row["id"] != product_id for row in client.get("/api/products/definitions", headers=viewer).json())
    archived_rows = client.get("/api/products/definitions?include_archived=true", headers=viewer)
    assert any(row["id"] == product_id and row["status"] == "archived" for row in archived_rows.json())
    assert client.get(f"/api/products/definitions/{product_id}", headers=viewer).status_code == 200
    assert client.get(f"/api/products/definitions/{product_id}/name-history", headers=viewer).status_code == 200

    restored = command(client, ops, "RestoreProductDefinition", {
        "product_definition_id": product_id,
        "expected_version": 4,
    }, f"product-restore-{suffix}")
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
            EventRecord.object_type == "ProductDefinition",
            EventRecord.object_id == product_id,
        )).all()
        assert {loads(event.payload_json)["correlation_id"] for event in events} == command_ids
        assert {event.event_type for event in events} == {
            "ProductDefinitionCreated",
            "ProductDefinitionUpdated",
            "ProductDefinitionArchived",
            "ProductDefinitionRestored",
        }

from __future__ import annotations

from uuid import uuid4

from sqlalchemy import select
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.db import SessionLocal
from uok.kernel_models import EventRecord
from uok.util import loads
from uok_contacts_core.duplicate_merge_history import PRIVATE_MERGE_SNAPSHOT_EVENT
from uok_contacts_core.models import Party


def _install(client: TestClient) -> dict[str, str]:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    installed = client.post("/api/modules/contacts.core/install", headers=admin)
    assert installed.status_code == 200, installed.text
    return ops


def _create_contact(client: TestClient, ops: dict[str, str], name: str, email: str, phone: str) -> str:
    created = command(
        client,
        ops,
        "CreateContact",
        {"display_name": name, "email": email, "phone": phone},
        f"merge-guard-create-{uuid4()}",
    )
    assert created.status_code == 200, created.text
    return created.json()["result"]["contact_id"]


def _unique_phone() -> str:
    digits = str(uuid4().int)[-10:]
    return f"+1{digits}"


def test_merge_keeps_only_public_metadata_in_attrs_and_private_snapshot_supports_rollback(
    client: TestClient,
) -> None:
    suffix = str(uuid4())
    ops = _install(client)
    primary_email = f"private-primary-{suffix}@example.test"
    duplicate_email = f"private-duplicate-{suffix}@example.test"
    primary_phone = _unique_phone()
    duplicate_phone = _unique_phone()
    primary = _create_contact(client, ops, f"Private Primary {suffix}", primary_email, primary_phone)
    duplicate = _create_contact(client, ops, f"Private Duplicate {suffix}", duplicate_email, duplicate_phone)

    merged = command(
        client,
        ops,
        "MergeDuplicateContact",
        {
            "primary_party_id": primary,
            "duplicate_party_id": duplicate,
            "field_choices": {"phone": "duplicate"},
        },
        f"private-merge-{suffix}",
    )
    assert merged.status_code == 200, merged.text
    result = merged.json()["result"]
    public_history = result["attrs"]["merge_history"]
    assert len(public_history) == 1
    assert set(public_history[0]) == {
        "duplicate_party_id",
        "merge_id",
        "merged_at",
        "primary_party_id",
    }

    with SessionLocal() as db:
        primary_row = db.get(Party, primary)
        assert primary_row is not None
        stored_history = loads(primary_row.attrs_json, {})["merge_history"]
        assert stored_history == public_history
        event = db.scalar(select(EventRecord).where(
            EventRecord.organization_id == primary_row.organization_id,
            EventRecord.event_type == PRIVATE_MERGE_SNAPSHOT_EVENT,
            EventRecord.object_id == primary,
        ))
        assert event is not None
        private_snapshot = loads(event.payload_json, {})["private_snapshot"]
        assert private_snapshot["primary_attrs_before"]["email"] == primary_email
        assert private_snapshot["duplicate_attrs_before"]["email"] == duplicate_email
        assert private_snapshot["post_merge_fingerprint"]

    rolled_back = command(
        client,
        ops,
        "RollbackDuplicateMerge",
        {
            "primary_party_id": primary,
            "duplicate_party_id": duplicate,
            "merge_id": result["merge_id"],
        },
        f"private-rollback-{suffix}",
    )
    assert rolled_back.status_code == 200, rolled_back.text
    assert rolled_back.json()["result"]["phone"] == primary_phone
    restored = client.get(f"/api/contacts/{duplicate}", headers=ops)
    assert restored.status_code == 200, restored.text
    assert restored.json()["email"] == duplicate_email


def test_merge_rollback_rejects_intervening_contact_edits_without_overwriting_them(
    client: TestClient,
) -> None:
    suffix = str(uuid4())
    ops = _install(client)
    primary = _create_contact(client, ops, f"Guard Primary {suffix}", f"guard-primary-{suffix}@example.test", _unique_phone())
    duplicate = _create_contact(client, ops, f"Guard Duplicate {suffix}", f"guard-duplicate-{suffix}@example.test", _unique_phone())
    merged = command(
        client,
        ops,
        "MergeDuplicateContact",
        {"primary_party_id": primary, "duplicate_party_id": duplicate},
        f"guard-merge-{suffix}",
    )
    assert merged.status_code == 200, merged.text
    merge_id = merged.json()["result"]["merge_id"]

    edited = command(
        client,
        ops,
        "UpdateContact",
        {"party_id": primary, "title": "Intervening edit"},
        f"guard-edit-{suffix}",
    )
    assert edited.status_code == 200, edited.text
    rejected = command(
        client,
        ops,
        "RollbackDuplicateMerge",
        {"primary_party_id": primary, "duplicate_party_id": duplicate, "merge_id": merge_id},
        f"guard-rollback-{suffix}",
    )
    assert rejected.status_code == 400, rejected.text
    assert "changed since merge" in rejected.text

    current = client.get(f"/api/contacts/{primary}", headers=ops)
    archived_duplicate = client.get(f"/api/contacts/{duplicate}", headers=ops)
    assert current.status_code == 200 and current.json()["title"] == "Intervening edit"
    assert archived_duplicate.status_code == 200
    assert archived_duplicate.json()["status"] == "archived"
    assert archived_duplicate.json()["attrs"]["merged_into_party_id"] == primary


def test_contact_already_merged_as_a_duplicate_cannot_enter_another_merge(client: TestClient) -> None:
    suffix = str(uuid4())
    ops = _install(client)
    first_primary = _create_contact(client, ops, f"First Primary {suffix}", f"first-{suffix}@example.test", _unique_phone())
    merged_duplicate = _create_contact(client, ops, f"Merged Duplicate {suffix}", f"merged-{suffix}@example.test", _unique_phone())
    second_primary = _create_contact(client, ops, f"Second Primary {suffix}", f"second-{suffix}@example.test", _unique_phone())
    first_merge = command(
        client,
        ops,
        "MergeDuplicateContact",
        {"primary_party_id": first_primary, "duplicate_party_id": merged_duplicate},
        f"first-merge-{suffix}",
    )
    assert first_merge.status_code == 200, first_merge.text

    reused_duplicate = command(
        client,
        ops,
        "MergeDuplicateContact",
        {"primary_party_id": second_primary, "duplicate_party_id": merged_duplicate},
        f"reused-duplicate-{suffix}",
    )
    assert reused_duplicate.status_code == 400, reused_duplicate.text
    assert "duplicate_party_id is already merged" in reused_duplicate.text

    reused_as_primary = command(
        client,
        ops,
        "MergeDuplicateContact",
        {"primary_party_id": merged_duplicate, "duplicate_party_id": second_primary},
        f"reused-primary-{suffix}",
    )
    assert reused_as_primary.status_code == 400, reused_as_primary.text
    assert "primary_party_id is already merged" in reused_as_primary.text

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.db import SessionLocal
from uok_contacts_core.models import Party


def _install(client: TestClient) -> tuple[dict[str, str], dict[str, str]]:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    installed = client.post("/api/modules/contacts.core/install", headers=admin)
    assert installed.status_code == 200, installed.text
    return admin, ops


def test_purge_anonymizes_the_complete_merged_identity_and_cross_record_references(client: TestClient) -> None:
    suffix = str(uuid4())
    admin, ops = _install(client)
    shared_email = f"merged-erase-{suffix}@example.test"
    primary = command(
        client, ops, "CreateContact",
        {"display_name": f"Primary Identity {suffix}", "email": shared_email},
        f"merged-primary-{suffix}",
    ).json()["result"]["contact_id"]
    duplicate = command(
        client, ops, "CreateContact",
        {"display_name": f"Duplicate Identity {suffix}", "email": shared_email},
        f"merged-duplicate-{suffix}",
    ).json()["result"]["contact_id"]
    nested_duplicate = command(
        client, ops, "CreateContact",
        {"display_name": f"Nested Duplicate Identity {suffix}", "email": shared_email},
        f"merged-nested-duplicate-{suffix}",
    ).json()["result"]["contact_id"]
    observer = command(
        client, ops, "CreateContact",
        {"display_name": f"Observer {suffix}", "email": shared_email},
        f"merged-observer-{suffix}",
    ).json()["result"]["contact_id"]
    nested_merge = command(
        client, ops, "MergeDuplicateContact",
        {"primary_party_id": duplicate, "duplicate_party_id": nested_duplicate},
        f"merged-nested-merge-{suffix}",
    )
    assert nested_merge.status_code == 200, nested_merge.text
    merged = command(
        client, ops, "MergeDuplicateContact",
        {"primary_party_id": primary, "duplicate_party_id": duplicate},
        f"merged-merge-{suffix}",
    )
    assert merged.status_code == 200, merged.text
    purged = command(client, admin, "PurgeContact", {"party_id": nested_duplicate}, f"merged-purge-{suffix}")
    assert purged.status_code == 200, purged.text
    assert purged.json()["result"]["related_tombstone_count"] == 2

    with SessionLocal() as db:
        primary_row = db.get(Party, primary)
        duplicate_row = db.get(Party, duplicate)
        nested_duplicate_row = db.get(Party, nested_duplicate)
        observer_row = db.get(Party, observer)
        assert primary_row is not None and primary_row.status == "purged"
        assert duplicate_row is not None and duplicate_row.status == "purged"
        assert nested_duplicate_row is not None and nested_duplicate_row.status == "purged"
        assert observer_row is not None and observer_row.status == "active"
        assert primary not in observer_row.attrs_json
        assert duplicate not in observer_row.attrs_json
        assert nested_duplicate not in observer_row.attrs_json
        assert shared_email not in primary_row.attrs_json
        assert shared_email not in duplicate_row.attrs_json
        assert shared_email not in nested_duplicate_row.attrs_json


def test_duplicate_candidate_resolution_is_concurrency_safe_and_tracks_merge_rollback(client: TestClient) -> None:
    suffix = str(uuid4())
    _, ops = _install(client)
    email = f"candidate-{suffix}@example.test"
    left = command(
        client, ops, "CreateContact",
        {"display_name": f"Candidate Left {suffix}", "email": email},
        f"candidate-left-{suffix}",
    ).json()["result"]["contact_id"]
    right = command(
        client, ops, "CreateContact",
        {"display_name": f"Candidate Right {suffix}", "email": email},
        f"candidate-right-{suffix}",
    ).json()["result"]["contact_id"]
    assert client.post("/api/contacts/duplicate-candidates/refresh", headers=ops).status_code == 200
    candidate = next(
        row for row in client.get("/api/contacts/duplicate-candidates", headers=ops).json()
        if {row["left_party_id"], row["right_party_id"]} == {left, right}
    )
    stale = client.post(
        f"/api/contacts/duplicate-candidates/{candidate['id']}/resolve",
        headers=ops,
        json={"status": "ignored", "expected_updated_at": "2000-01-01T00:00:00Z"},
    )
    assert stale.status_code == 400, stale.text
    assert "changed" in stale.text

    merged = command(
        client, ops, "MergeDuplicateContact",
        {"primary_party_id": left, "duplicate_party_id": right},
        f"candidate-merge-{suffix}",
    )
    assert merged.status_code == 200, merged.text
    merge_id = merged.json()["result"]["merge_id"]
    merged_candidates = client.get("/api/contacts/duplicate-candidates?status=merged", headers=ops).json()
    assert any(row["id"] == candidate["id"] for row in merged_candidates)

    rolled_back = command(
        client, ops, "RollbackDuplicateMerge",
        {"primary_party_id": left, "duplicate_party_id": right, "merge_id": merge_id},
        f"candidate-rollback-{suffix}",
    )
    assert rolled_back.status_code == 200, rolled_back.text
    open_candidates = client.get("/api/contacts/duplicate-candidates", headers=ops).json()
    assert any(row["id"] == candidate["id"] for row in open_candidates)

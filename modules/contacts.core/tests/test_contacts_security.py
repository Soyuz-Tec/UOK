from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command, user_id
from uok.contacts import MAX_CONTACT_NOTE_LENGTH, MAX_CSV_IMPORT_BYTES


def test_contact_visibility_metadata_is_enforced_on_reads(client: TestClient) -> None:
    suffix = str(uuid4())
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    trader = auth(client, "trader", "trader123")
    viewer = auth(client, "viewer", "viewer123")
    trader_user_id = user_id("trader")

    install = client.post("/api/modules/contacts.core/install", headers=admin)
    assert install.status_code == 200, install.text

    private_contact = command(
        client,
        ops,
        "CreateContact",
        {
            "display_name": f"Private Contact {suffix}",
            "email": f"private-{suffix}@example.test",
            "owner_user_id": trader_user_id,
            "visibility_scope": "private",
            "note": "Internal owner handoff note.",
        },
        f"uok-private-contact-{suffix}",
    )
    assert private_contact.status_code == 200, private_contact.text
    private_contact_id = private_contact.json()["result"]["contact_id"]

    team_contact = command(
        client,
        ops,
        "CreateContact",
        {
            "display_name": f"Team Contact {suffix}",
            "owner_user_id": trader_user_id,
            "team_id": f"team-{suffix}",
            "visibility_scope": "team",
        },
        f"uok-team-contact-{suffix}",
    )
    assert team_contact.status_code == 200, team_contact.text
    team_contact_id = team_contact.json()["result"]["contact_id"]

    organization_contact = command(
        client,
        ops,
        "CreateContact",
        {"display_name": f"Organization Contact {suffix}", "visibility_scope": "organization"},
        f"uok-organization-contact-{suffix}",
    )
    assert organization_contact.status_code == 200, organization_contact.text
    organization_contact_id = organization_contact.json()["result"]["contact_id"]

    hidden_private = client.get(f"/api/contacts/{private_contact_id}", headers=viewer)
    assert hidden_private.status_code == 403, hidden_private.text

    hidden_team = client.get(f"/api/contacts/{team_contact_id}", headers=viewer)
    assert hidden_team.status_code == 403, hidden_team.text

    owner_private = client.get(f"/api/contacts/{private_contact_id}", headers=trader)
    assert owner_private.status_code == 200, owner_private.text
    assert owner_private.json()["id"] == private_contact_id
    assert owner_private.json()["notes"] == []

    admin_private = client.get(f"/api/contacts/{private_contact_id}", headers=admin)
    assert admin_private.status_code == 200, admin_private.text
    assert admin_private.json()["notes"]

    viewer_list = client.get("/api/contacts?status=all", headers=viewer)
    assert viewer_list.status_code == 200, viewer_list.text
    viewer_ids = {row["id"] for row in viewer_list.json()}
    assert organization_contact_id in viewer_ids
    assert private_contact_id not in viewer_ids
    assert team_contact_id not in viewer_ids

    public_notes = client.get(f"/api/contacts/{organization_contact_id}/notes", headers=viewer)
    assert public_notes.status_code == 200, public_notes.text
    assert public_notes.json() == []


def test_contacts_list_supports_bounded_pagination_and_sorting(client: TestClient) -> None:
    suffix = str(uuid4())
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")

    install = client.post("/api/modules/contacts.core/install", headers=admin)
    assert install.status_code == 200, install.text

    names = [
        f"Zeta Page Contact {suffix}",
        f"Alpha Page Contact {suffix}",
        f"Gamma Page Contact {suffix}",
    ]
    for index, name in enumerate(names):
        created = command(
            client,
            ops,
            "CreateContact",
            {"display_name": name},
            f"uok-page-contact-{suffix}-{index}",
        )
        assert created.status_code == 200, created.text

    first_page = client.get(
        "/api/contacts",
        headers=admin,
        params={
            "query": f"Page Contact {suffix}",
            "status": "all",
            "limit": 2,
            "offset": 0,
            "sort_by": "display_name",
            "sort_dir": "asc",
        },
    )
    assert first_page.status_code == 200, first_page.text
    assert first_page.headers["x-total-count"] == "3"
    assert [row["display_name"] for row in first_page.json()] == [names[1], names[2]]

    second_page = client.get(
        "/api/contacts",
        headers=admin,
        params={
            "query": f"Page Contact {suffix}",
            "status": "all",
            "limit": 2,
            "offset": 2,
            "sort_by": "display_name",
            "sort_dir": "asc",
        },
    )
    assert second_page.status_code == 200, second_page.text
    assert second_page.headers["x-total-count"] == "3"
    assert [row["display_name"] for row in second_page.json()] == [names[0]]

    invalid_limit = client.get("/api/contacts?limit=0", headers=admin)
    assert invalid_limit.status_code == 422, invalid_limit.text

    invalid_sort = client.get("/api/contacts?sort_by=attrs_json", headers=admin)
    assert invalid_sort.status_code == 422, invalid_sort.text


def test_idempotency_replay_requires_permission_and_matching_payload(client: TestClient) -> None:
    suffix = str(uuid4())
    key = f"uok-idempotency-{suffix}"
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")

    install = client.post("/api/modules/contacts.core/install", headers=admin)
    assert install.status_code == 200, install.text

    payload = {"display_name": f"Replay Contact {suffix}", "company_name": "Replay Account"}
    created = command(client, ops, "CreateContact", payload, key)
    assert created.status_code == 200, created.text
    replayed = command(client, ops, "CreateContact", payload, key)
    assert replayed.status_code == 200, replayed.text
    assert replayed.json()["idempotent"] is True

    denied_replay = command(client, viewer, "CreateContact", payload, key)
    assert denied_replay.status_code == 403, denied_replay.text

    mismatched_payload = command(
        client,
        ops,
        "CreateContact",
        {"display_name": f"Replay Contact Changed {suffix}", "company_name": "Replay Account"},
        key,
    )
    assert mismatched_payload.status_code == 400, mismatched_payload.text
    assert "different command request" in mismatched_payload.text

    mismatched_command = command(client, ops, "AddContactNote", {"party_id": created.json()["result"]["contact_id"], "body": "Note"}, key)
    assert mismatched_command.status_code == 400, mismatched_command.text
    assert "different command request" in mismatched_command.text


def test_contact_and_import_payload_limits_are_enforced(client: TestClient) -> None:
    suffix = str(uuid4())
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")

    install = client.post("/api/modules/contacts.core/install", headers=admin)
    assert install.status_code == 200, install.text

    oversized_login = client.post("/api/auth/login", json={"username": "a" * 255, "password": "admin"})
    assert oversized_login.status_code == 422, oversized_login.text

    oversized_note = command(
        client,
        ops,
        "CreateContact",
        {"display_name": f"Oversized Note {suffix}", "note": "n" * (MAX_CONTACT_NOTE_LENGTH + 1)},
        f"uok-oversized-note-{suffix}",
    )
    assert oversized_note.status_code == 400, oversized_note.text
    assert "note must be" in oversized_note.text

    oversized_csv = command(
        client,
        ops,
        "ImportContactsCsv",
        {"filename": "oversized.csv", "csv_text": "display_name\n" + ("A" * MAX_CSV_IMPORT_BYTES)},
        f"uok-oversized-csv-{suffix}",
    )
    assert oversized_csv.status_code == 400, oversized_csv.text
    assert "csv_text must be" in oversized_csv.text

from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.contacts import MAX_CONTACT_NOTE_LENGTH, MAX_CSV_IMPORT_BYTES


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
    mismatched_payload = command(client, ops, "CreateContact", {"display_name": f"Replay Contact Changed {suffix}"}, key)
    assert mismatched_payload.status_code == 409, mismatched_payload.text
    assert "different command request" in mismatched_payload.text

    note_payload = {"party_id": created.json()["result"]["contact_id"], "body": "Note"}
    mismatched_command = command(client, ops, "AddContactNote", note_payload, key)
    assert mismatched_command.status_code == 409, mismatched_command.text
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

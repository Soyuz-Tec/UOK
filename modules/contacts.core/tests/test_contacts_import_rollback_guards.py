from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command


def _install(client: TestClient) -> dict[str, str]:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    installed = client.post("/api/modules/contacts.core/install", headers=admin)
    assert installed.status_code == 200, installed.text
    return ops


def test_import_rollback_restores_pre_batch_state_and_rejects_intervening_edits(client: TestClient) -> None:
    suffix = str(uuid4())
    ops = _install(client)
    email = f"rollback-{suffix}@example.test"
    created = command(
        client,
        ops,
        "CreateContact",
        {"display_name": f"Original {suffix}", "email": email},
        f"rollback-create-{suffix}",
    )
    assert created.status_code == 200, created.text
    party_id = created.json()["result"]["contact_id"]
    imported = client.post(
        "/api/contacts/import-csv",
        headers=ops,
        json={
            "filename": "multi-update.csv",
            "csv_text": (
                "Full Name,Mail\n"
                f"Intermediate {suffix},{email}\n"
                f"Final {suffix},{email}\n"
            ),
            "mode": "update",
            "mapping": {"display_name": "Full Name", "email": "Mail"},
        },
    )
    assert imported.status_code == 200, imported.text
    assert imported.json()["updated_count"] == 2
    assert client.get(f"/api/contacts/{party_id}", headers=ops).json()["display_name"] == f"Final {suffix}"

    rolled_back = client.post(f"/api/contacts/import-batches/{imported.json()['batch_id']}/rollback", headers=ops)
    assert rolled_back.status_code == 200, rolled_back.text
    assert rolled_back.json()["rolled_back_count"] == 2
    restored = client.get(f"/api/contacts/{party_id}", headers=ops)
    assert restored.status_code == 200, restored.text
    assert restored.json()["display_name"] == f"Original {suffix}"

    later_batch = client.post(
        "/api/contacts/import-csv",
        headers=ops,
        json={
            "filename": "guarded-update.csv",
            "csv_text": f"Full Name,Mail\nBatch update {suffix},{email}\n",
            "mode": "update",
            "mapping": {"display_name": "Full Name", "email": "Mail"},
        },
    )
    assert later_batch.status_code == 200, later_batch.text
    intervening = command(
        client,
        ops,
        "UpdateContact",
        {"party_id": party_id, "display_name": f"Manual edit {suffix}"},
        f"rollback-intervening-{suffix}",
    )
    assert intervening.status_code == 200, intervening.text
    refused = client.post(f"/api/contacts/import-batches/{later_batch.json()['batch_id']}/rollback", headers=ops)
    assert refused.status_code == 400, refused.text
    assert "changed after import" in refused.text
    assert client.get(f"/api/contacts/{party_id}", headers=ops).json()["display_name"] == f"Manual edit {suffix}"

from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command


def test_contact_extended_editor_fields_round_trip(client: TestClient) -> None:
    suffix = str(uuid4())
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")

    install = client.post("/api/modules/contacts.core/install", headers=admin)
    assert install.status_code == 200, install.text

    created = command(
        client,
        ops,
        "CreateContact",
        {
            "display_name": f"Extended Contact {suffix}",
            "email": f"extended-{suffix}@example.test",
            "birthday": "1984-03-12",
            "important_date": "2026-07-08",
            "instant_message": f"signal:extended-{suffix}",
            "tags": "supplier, finance",
            "source": "gmail",
            "client_reference": f"gmail-thread-{suffix}",
        },
        f"uok-extended-contact-create-{suffix}",
    )
    assert created.status_code == 200, created.text
    contact_id = created.json()["result"]["contact_id"]

    detail = client.get(f"/api/contacts/{contact_id}", headers=ops)
    assert detail.status_code == 200, detail.text
    result = detail.json()
    assert result["birthday"] == "1984-03-12"
    assert result["important_date"] == "2026-07-08"
    assert result["instant_message"] == f"signal:extended-{suffix}"
    assert result["tags"] == "supplier, finance"
    assert result["source"] == "gmail"
    assert result["client_reference"] == f"gmail-thread-{suffix}"

    updated = command(
        client,
        ops,
        "UpdateContact",
        {
            "party_id": contact_id,
            "birthday": "1985-04-13",
            "tags": "supplier, reviewed",
            "source": "contacts",
            "client_reference": f"reviewed-{suffix}",
        },
        f"uok-extended-contact-update-{suffix}",
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["result"]["birthday"] == "1985-04-13"
    assert updated.json()["result"]["tags"] == "supplier, reviewed"
    assert updated.json()["result"]["source"] == "contacts"
    assert updated.json()["result"]["client_reference"] == f"reviewed-{suffix}"

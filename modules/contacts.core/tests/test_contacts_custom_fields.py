from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command


def test_custom_field_contract_preserves_choice_options_and_value_type(client: TestClient) -> None:
    suffix = str(uuid4())
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    installed = client.post("/api/modules/contacts.core/install", headers=admin)
    assert installed.status_code == 200, installed.text
    created = command(
        client,
        ops,
        "CreateContact",
        {"display_name": f"Custom Field Contact {suffix}"},
        f"custom-field-contact-{suffix}",
    )
    assert created.status_code == 200, created.text
    party_id = created.json()["result"]["contact_id"]

    defined = client.post(
        "/api/contacts/custom-fields",
        headers=ops,
        json={
            "field_key": f"tier_{suffix.replace('-', '_')}",
            "label": "Account tier",
            "field_type": "choice",
            "applies_to": "all",
            "options": ["standard", "preferred"],
        },
    )
    assert defined.status_code == 200, defined.text
    definition = defined.json()
    assert definition["options"] == ["standard", "preferred"]

    listed = client.get("/api/contacts/custom-fields", headers=ops)
    assert listed.status_code == 200, listed.text
    assert next(row for row in listed.json() if row["id"] == definition["id"])["options"] == ["standard", "preferred"]

    updated = client.put(
        f"/api/contacts/{party_id}/custom-fields/{definition['id']}",
        headers=ops,
        json={"value": "preferred"},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["field_type"] == "choice"
    assert updated.json()["value"] == "preferred"

    values = client.get(f"/api/contacts/{party_id}/custom-fields", headers=ops)
    assert values.status_code == 200, values.text
    assert values.json()[0]["field_type"] == "choice"
    assert values.json()[0]["value"] == "preferred"


def test_custom_field_key_schema_rejects_a_one_character_key(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    installed = client.post("/api/modules/contacts.core/install", headers=admin)
    assert installed.status_code == 200, installed.text

    response = client.post(
        "/api/contacts/custom-fields",
        headers=ops,
        json={"field_key": "x", "label": "Invalid", "field_type": "text"},
    )
    assert response.status_code == 422, response.text

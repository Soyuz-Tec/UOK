from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command


def test_contact_phone_numbers_normalize_to_e164_and_preserve_placeholders(client: TestClient) -> None:
    suffix = str(uuid4())
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")

    install = client.post("/api/modules/contacts.core/install", headers=admin)
    assert install.status_code == 200, install.text

    contact = command(
        client,
        ops,
        "CreateContact",
        {"display_name": f"Phone Normalized {suffix}", "phone": "(650) 253-0000"},
        f"uok-phone-normalized-{suffix}",
    )
    assert contact.status_code == 200, contact.text
    contact_id = contact.json()["result"]["contact_id"]
    assert contact.json()["result"]["phone"] == "+16502530000"

    duplicate = command(
        client,
        ops,
        "CreateContact",
        {"display_name": f"Phone Duplicate {suffix}", "phone": "650.253.0000"},
        f"uok-phone-duplicate-{suffix}",
    )
    assert duplicate.status_code == 200, duplicate.text
    duplicate_body = duplicate.json()["result"]
    assert duplicate_body["phone"] == "+16502530000"
    assert duplicate_body["review_state"] == "possible_duplicate"
    duplicate_candidates = duplicate_body["attrs"]["duplicate_candidates"]
    assert any(row["id"] == contact_id and "phone" in row["reason"] for row in duplicate_candidates)

    placeholder = command(
        client,
        ops,
        "UpdateContact",
        {"party_id": contact_id, "phone": "+1 555 0100"},
        f"uok-phone-placeholder-{suffix}",
    )
    assert placeholder.status_code == 200, placeholder.text
    assert placeholder.json()["result"]["phone"] == "+1 555 0100"


def test_contact_phone_only_display_name_uses_normalized_number(client: TestClient) -> None:
    suffix = str(uuid4())
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")

    install = client.post("/api/modules/contacts.core/install", headers=admin)
    assert install.status_code == 200, install.text

    contact = command(
        client,
        ops,
        "CreateContact",
        {"phone": "650 253 0000"},
        f"uok-phone-display-{suffix}",
    )
    assert contact.status_code == 200, contact.text
    result = contact.json()["result"]
    assert result["display_name"] == "+16502530000"
    assert result["phone"] == "+16502530000"

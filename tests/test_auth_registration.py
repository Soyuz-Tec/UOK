from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth


def test_self_registration_can_be_disabled(client: TestClient, monkeypatch) -> None:
    monkeypatch.setenv("UOK_SELF_REGISTRATION", "0")
    disabled = client.post(
        "/api/auth/register",
        json={
            "display_name": "Local User",
            "email": f"disabled-{uuid4()}@example.test",
            "password": "registered123",
        },
    )
    assert disabled.status_code == 403, disabled.text


def test_self_registration_accepts_name_and_valid_email(client: TestClient) -> None:
    suffix = str(uuid4())
    email = f"registered-{suffix}@example.test"
    invalid = client.post(
        "/api/auth/register",
        json={
            "display_name": "Local User",
            "email": "not-an-email",
            "password": "registered123",
        },
    )
    assert invalid.status_code == 400, invalid.text

    registered = client.post(
        "/api/auth/register",
        json={
            "display_name": "Local Registered User",
            "email": email.upper(),
            "password": "registered123",
        },
    )
    assert registered.status_code == 200, registered.text
    body = registered.json()
    assert body["access_token"]
    assert body["user"]["display_name"] == "Local Registered User"
    assert body["user"]["email"] == email
    assert body["user"]["username"] == email
    assert body["user"]["role"] == "pending_user"

    duplicate = client.post(
        "/api/auth/register",
        json={
            "display_name": "Duplicate User",
            "email": email,
            "password": "registered123",
        },
    )
    assert duplicate.status_code == 409, duplicate.text

    headers = auth(client, email, "registered123")
    catalog = client.get("/api/modules/catalog", headers=headers)
    assert catalog.status_code == 200, catalog.text

    contacts = client.get("/api/contacts", headers=headers)
    assert contacts.status_code == 403, contacts.text

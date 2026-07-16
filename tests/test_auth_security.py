from __future__ import annotations

from hashlib import sha256
from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth
from uok.host.application import AUTH_ATTEMPTS, AUTH_RATE_LIMIT_MAX_KEYS, auth_rate_key, rate_limit_auth
from uok.host.security import issue_token
from uok.kernel.security import Actor
from uok.util import hash_password, password_needs_rehash, verify_password


def test_password_hashing_uses_argon2id_and_accepts_legacy_sha256() -> None:
    password_hash = hash_password("admin")
    assert password_hash.startswith("$argon2id$")
    assert verify_password("admin", password_hash) is True
    assert verify_password("wrong", password_hash) is False
    assert password_needs_rehash(password_hash) is False

    legacy_hash = sha256("admin".encode("utf-8")).hexdigest()
    assert verify_password("admin", legacy_hash) is True
    assert password_needs_rehash(legacy_hash) is True


def test_weak_runtime_secret_is_rejected_outside_local_mode(monkeypatch) -> None:
    monkeypatch.setenv("UOK_SECRET", "local-uok-change-me")
    monkeypatch.setenv("UOK_ALLOW_INSECURE_LOCAL_DEFAULTS", "0")
    actor = Actor(user_id="user", username="admin", organization_id="org", role="platform_admin")
    try:
        issue_token(actor)
    except RuntimeError as exc:
        assert "weak local-only" in str(exc)
    else:
        raise AssertionError("weak UOK_SECRET unexpectedly issued a token")


def test_self_registration_can_be_disabled(client: TestClient, monkeypatch) -> None:
    monkeypatch.setenv("UOK_SELF_REGISTRATION", "0")
    disabled = client.post("/api/auth/register", json={
        "display_name": "Local User",
        "email": f"disabled-{uuid4()}@example.test",
        "password": "registered123",
    })
    assert disabled.status_code == 403, disabled.text


def test_self_registration_accepts_name_and_valid_email(client: TestClient) -> None:
    suffix = str(uuid4())
    email = f"registered-{suffix}@example.test"
    invalid = client.post("/api/auth/register", json={
        "display_name": "Local User",
        "email": "not-an-email",
        "password": "registered123",
    })
    assert invalid.status_code == 400, invalid.text

    registered = client.post("/api/auth/register", json={
        "display_name": "Local Registered User",
        "email": email.upper(),
        "password": "registered123",
    })
    assert registered.status_code == 200, registered.text
    body = registered.json()
    assert body["access_token"]
    assert body["user"]["display_name"] == "Local Registered User"
    assert body["user"]["email"] == email
    assert body["user"]["username"] == email
    assert body["user"]["role"] == "pending_user"

    duplicate = client.post("/api/auth/register", json={
        "display_name": "Duplicate User",
        "email": email,
        "password": "registered123",
    })
    assert duplicate.status_code == 409, duplicate.text

    headers = auth(client, email, "registered123")
    catalog = client.get("/api/modules/catalog", headers=headers)
    assert catalog.status_code == 200, catalog.text

    contacts = client.get("/api/contacts", headers=headers)
    assert contacts.status_code == 403, contacts.text


def test_auth_rate_limit_keys_are_hashed_and_bounded() -> None:
    AUTH_ATTEMPTS.clear()
    try:
        long_identity = "Admin" + ("x" * 10000)
        key = auth_rate_key("login", long_identity)
        assert long_identity.lower() not in key
        assert len(key) < 80

        for index in range(AUTH_RATE_LIMIT_MAX_KEYS + 5):
            rate_limit_auth(f"test-key-{index}")
        assert len(AUTH_ATTEMPTS) <= AUTH_RATE_LIMIT_MAX_KEYS
    finally:
        AUTH_ATTEMPTS.clear()

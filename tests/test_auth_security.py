from __future__ import annotations

from datetime import datetime, timedelta, timezone
from hashlib import sha256

import pytest
from sqlalchemy import select
from starlette.testclient import TestClient

from uok.api import auth as auth_api
from uok.api.auth import build_legacy_sha256_login_deadline, is_valid_email
from uok.host.security import issue_token
from uok.host.database import SessionLocal
from uok.kernel.security import Actor
from uok.kernel_models import User
from uok.util import hash_password, password_needs_rehash, verify_password


def test_password_hashing_uses_argon2id_and_rejects_legacy_sha256() -> None:
    password_hash = hash_password("admin")
    assert password_hash.startswith("$argon2id$")
    assert verify_password("admin", password_hash) is True
    assert verify_password("wrong", password_hash) is False
    assert password_needs_rehash(password_hash) is False

    legacy_hash = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918"
    assert verify_password("admin", legacy_hash) is False
    assert verify_password("admin", legacy_hash, allow_legacy_sha256=True) is True
    assert verify_password("wrong", legacy_hash, allow_legacy_sha256=True) is False
    assert password_needs_rehash(legacy_hash) is True


def test_legacy_sha256_login_migration_is_explicit_bounded_and_one_time(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    legacy_hash = sha256(b"admin").hexdigest()
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == "admin"))
        assert user is not None
        user.password_hash = legacy_hash
        db.commit()

    rejected = client.post(
        "/api/auth/login", json={"username": "admin", "password": "admin"}
    )
    unknown = client.post(
        "/api/auth/login", json={"username": "missing-user", "password": "admin"}
    )
    assert rejected.status_code == unknown.status_code == 401
    assert (
        rejected.json() == unknown.json() == {"detail": "Invalid username or password"}
    )

    monkeypatch.setattr(
        auth_api,
        "LEGACY_SHA256_LOGIN_DEADLINE",
        datetime.now(timezone.utc) - timedelta(seconds=1),
    )
    expired = client.post(
        "/api/auth/login", json={"username": "admin", "password": "admin"}
    )
    assert expired.status_code == 401
    assert expired.json() == rejected.json()

    monkeypatch.setattr(
        auth_api,
        "LEGACY_SHA256_LOGIN_DEADLINE",
        datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    wrong = client.post(
        "/api/auth/login", json={"username": "admin", "password": "wrong"}
    )
    assert wrong.status_code == 401
    accepted = client.post(
        "/api/auth/login", json={"username": "admin", "password": "admin"}
    )
    assert accepted.status_code == 200, accepted.text

    with SessionLocal() as db:
        migrated = db.scalar(select(User).where(User.username == "admin"))
        assert migrated is not None
        assert migrated.password_hash.startswith("$argon2id$")
        assert migrated.password_hash != legacy_hash


def test_legacy_sha256_login_window_configuration_fails_closed() -> None:
    now = datetime(2030, 1, 1, tzinfo=timezone.utc)
    valid = build_legacy_sha256_login_deadline(
        {
            "UOK_LEGACY_SHA256_LOGIN_MIGRATION": "1",
            "UOK_LEGACY_SHA256_LOGIN_UNTIL": "2030-01-02T00:00:00Z",
        },
        now=now,
    )
    assert valid == datetime(2030, 1, 2, tzinfo=timezone.utc)

    invalid_environments = (
        {"UOK_LEGACY_SHA256_LOGIN_MIGRATION": "sometimes"},
        {"UOK_LEGACY_SHA256_LOGIN_UNTIL": "2030-01-02T00:00:00Z"},
        {"UOK_LEGACY_SHA256_LOGIN_MIGRATION": "1"},
        {
            "UOK_LEGACY_SHA256_LOGIN_MIGRATION": "1",
            "UOK_LEGACY_SHA256_LOGIN_UNTIL": "2030-01-02T00:00:00+00:00",
        },
        {
            "UOK_LEGACY_SHA256_LOGIN_MIGRATION": "1",
            "UOK_LEGACY_SHA256_LOGIN_UNTIL": "2029-12-31T23:59:59Z",
        },
        {
            "UOK_LEGACY_SHA256_LOGIN_MIGRATION": "1",
            "UOK_LEGACY_SHA256_LOGIN_UNTIL": "2030-01-16T00:00:00Z",
        },
    )
    for environment in invalid_environments:
        with pytest.raises(RuntimeError):
            build_legacy_sha256_login_deadline(environment, now=now)


def test_email_validation_is_bounded_and_preserves_supported_addresses() -> None:
    assert is_valid_email(" User.Name+tag@sub.example.test ") is True
    assert is_valid_email("not-an-email") is False
    assert is_valid_email("user@@example.test") is False
    assert is_valid_email("user @example.test") is False
    assert is_valid_email("user@example.") is False
    assert is_valid_email(("a" * 255) + "@example.test") is False


def test_weak_runtime_secret_is_rejected_outside_local_mode(monkeypatch) -> None:
    monkeypatch.setenv("UOK_SECRET", "local-uok-change-me")
    monkeypatch.setenv("UOK_ALLOW_INSECURE_LOCAL_DEFAULTS", "0")
    actor = Actor(
        user_id="user", username="admin", organization_id="org", role="platform_admin"
    )
    try:
        issue_token(actor)
    except RuntimeError as exc:
        assert "weak local-only" in str(exc)
    else:
        raise AssertionError("weak UOK_SECRET unexpectedly issued a token")

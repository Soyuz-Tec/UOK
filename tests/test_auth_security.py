from __future__ import annotations

from argon2 import PasswordHasher
from argon2.low_level import Type
from sqlalchemy import select
from starlette.testclient import TestClient

from uok.api.auth import is_valid_email
from uok.host.database import SessionLocal
from uok.host.security import issue_token
from uok.kernel.security import Actor
from uok.kernel_models import User
from uok.util import hash_password, password_needs_rehash, verify_password


LEGACY_ADMIN_HASH = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918"


def test_password_hashing_is_argon2id_only() -> None:
    password_hash = hash_password("admin")
    assert password_hash.startswith("$argon2id$")
    assert verify_password("admin", password_hash) is True
    assert verify_password("wrong", password_hash) is False
    assert password_needs_rehash(password_hash) is False

    assert verify_password("admin", LEGACY_ADMIN_HASH) is False
    assert password_needs_rehash(LEGACY_ADMIN_HASH) is True

    argon2i_hash = PasswordHasher(type=Type.I).hash("admin")
    assert argon2i_hash.startswith("$argon2i$")
    assert verify_password("admin", argon2i_hash) is False
    assert password_needs_rehash(argon2i_hash) is True


def test_login_rejects_legacy_sha256_like_unknown_credentials(
    client: TestClient,
) -> None:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == "admin"))
        assert user is not None
        user.password_hash = LEGACY_ADMIN_HASH
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

    with SessionLocal() as db:
        unchanged = db.scalar(select(User).where(User.username == "admin"))
        assert unchanged is not None
        assert unchanged.password_hash == LEGACY_ADMIN_HASH


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

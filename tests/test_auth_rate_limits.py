from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from time import sleep

import pytest
from fastapi import HTTPException
from starlette.testclient import TestClient

from uok.api import auth as auth_api
from uok.host.application import (
    AUTH_ATTEMPTS,
    AUTH_RATE_LIMIT_MAX_KEYS,
    auth_rate_key,
    rate_limit_auth,
)


def test_auth_rate_limit_keys_are_hashed_and_bounded() -> None:
    AUTH_ATTEMPTS.clear()
    try:
        long_identity = "Admin" + ("x" * 10000)
        key = auth_rate_key("login", long_identity)
        assert long_identity.lower() not in key
        assert len(key) < 80

        for index in range(AUTH_RATE_LIMIT_MAX_KEYS):
            rate_limit_auth(f"test-key-{index}")
        with pytest.raises(HTTPException) as exc_info:
            rate_limit_auth("overflow-key")
        assert exc_info.value.status_code == 429
        assert len(AUTH_ATTEMPTS) == AUTH_RATE_LIMIT_MAX_KEYS
    finally:
        AUTH_ATTEMPTS.clear()


def test_auth_rate_limit_saturation_cannot_evict_an_active_block() -> None:
    AUTH_ATTEMPTS.clear()
    blocked_key = "blocked-target"
    try:
        for _ in range(auth_api.AUTH_RATE_LIMIT_MAX_ATTEMPTS):
            rate_limit_auth(blocked_key)
        with pytest.raises(HTTPException):
            rate_limit_auth(blocked_key)

        for index in range(AUTH_RATE_LIMIT_MAX_KEYS - 1):
            rate_limit_auth(f"churn-{index}")
        with pytest.raises(HTTPException):
            rate_limit_auth("new-identity")
        with pytest.raises(HTTPException):
            rate_limit_auth(blocked_key)
        assert blocked_key in AUTH_ATTEMPTS
    finally:
        AUTH_ATTEMPTS.clear()


def test_auth_rate_limit_capacity_is_atomic_under_concurrency(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class SlowLengthDict(dict[str, list[float]]):
        def __len__(self) -> int:
            sleep(0.02)
            return super().__len__()

    attempts = SlowLengthDict(
        (f"occupied-{index}", [auth_api.monotonic()])
        for index in range(AUTH_RATE_LIMIT_MAX_KEYS - 1)
    )
    monkeypatch.setattr(auth_api, "AUTH_ATTEMPTS", attempts)
    ready = Barrier(2)

    def attempt(key: str) -> int:
        ready.wait()
        try:
            rate_limit_auth(key)
        except HTTPException as exc:
            return exc.status_code
        return 200

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(attempt, ("new-a", "new-b")))

    assert sorted(results) == [200, 429]
    assert len(attempts) == AUTH_RATE_LIMIT_MAX_KEYS


def test_successful_login_does_not_reset_client_anti_spray_bucket(
    client: TestClient,
) -> None:
    AUTH_ATTEMPTS.clear()
    try:
        for index in range(auth_api.AUTH_RATE_LIMIT_MAX_ATTEMPTS):
            rejected = client.post(
                "/api/auth/login",
                json={"username": f"victim-{index}", "password": "wrong"},
            )
            assert rejected.status_code == 401
            if index in {2, 5, 8}:
                accepted = client.post(
                    "/api/auth/login",
                    json={"username": "admin", "password": "admin"},
                )
                assert accepted.status_code == 200

        blocked = client.post(
            "/api/auth/login",
            json={"username": "another-victim", "password": "wrong"},
        )
        assert blocked.status_code == 429
    finally:
        AUTH_ATTEMPTS.clear()

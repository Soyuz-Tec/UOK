from __future__ import annotations

import asyncio
import json
from concurrent.futures import ThreadPoolExecutor
from time import monotonic

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import TimeoutError as SQLAlchemyTimeoutError
from sqlalchemy.pool import QueuePool
from starlette.requests import Request
from starlette.testclient import TestClient

from tests.helpers import auth
from uok import db_pool, main
from uok.db_pool import DatabasePoolTelemetry, PostgresPoolSettings, create_database_engine


def test_postgresql_pool_settings_have_bounded_safe_defaults() -> None:
    settings = PostgresPoolSettings.from_env({})

    assert settings.public_snapshot() == {
        "application_name": "uok-api",
        "connect_timeout_seconds": 5,
        "max_overflow": 10,
        "pool_pre_ping": True,
        "pool_recycle_seconds": None,
        "pool_size": 5,
        "pool_timeout_seconds": 30,
    }
    assert settings.engine_options()["pool_recycle"] == -1


@pytest.mark.parametrize("disabled_value", ["-1", "0"])
def test_postgresql_pool_recycle_accepts_explicit_disabled_values(disabled_value: str) -> None:
    settings = PostgresPoolSettings.from_env({"UOK_DB_POOL_RECYCLE_SECONDS": disabled_value})
    assert settings.pool_recycle_seconds is None
    assert settings.engine_options()["pool_recycle"] == -1


def test_postgresql_pool_settings_map_to_explicit_engine_options() -> None:
    settings = PostgresPoolSettings.from_env({
        "UOK_DB_POOL_SIZE": "7",
        "UOK_DB_MAX_OVERFLOW": "3",
        "UOK_DB_POOL_TIMEOUT_SECONDS": "9",
        "UOK_DB_POOL_PRE_PING": "false",
        "UOK_DB_POOL_RECYCLE_SECONDS": "120",
        "UOK_DB_CONNECT_TIMEOUT_SECONDS": "4",
        "UOK_DB_APPLICATION_NAME": "uok-api-test",
    })

    assert settings.engine_options() == {
        "connect_args": {"application_name": "uok-api-test", "connect_timeout": 4},
        "max_overflow": 3,
        "pool_pre_ping": False,
        "pool_recycle": 120,
        "pool_size": 7,
        "pool_timeout": 9,
    }


def test_postgresql_engine_uses_all_requested_pool_options_without_connecting(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured_options = {}
    sqlalchemy_create_engine = db_pool.create_engine

    def capture_options(database_url: str, **options):
        captured_options.update(options)
        return sqlalchemy_create_engine(database_url, **options)

    monkeypatch.setattr(db_pool, "create_engine", capture_options)
    engine, _ = create_database_engine(
        "postgresql+psycopg://pool_user:pool_password@example.test/uok",
        {
            "UOK_DB_POOL_SIZE": "7",
            "UOK_DB_MAX_OVERFLOW": "3",
            "UOK_DB_POOL_TIMEOUT_SECONDS": "9",
            "UOK_DB_POOL_PRE_PING": "true",
            "UOK_DB_POOL_RECYCLE_SECONDS": "120",
            "UOK_DB_CONNECT_TIMEOUT_SECONDS": "4",
            "UOK_DB_APPLICATION_NAME": "uok-api-test",
        },
    )
    try:
        assert isinstance(engine.pool, QueuePool)
        assert engine.pool.size() == 7
        assert engine.pool._max_overflow == 3
        assert engine.pool.timeout() == 9
        assert engine.pool._pre_ping is True
        assert engine.pool._recycle == 120
        assert captured_options["connect_args"] == {
            "application_name": "uok-api-test",
            "connect_timeout": 4,
        }
    finally:
        engine.dispose()


@pytest.mark.parametrize(
    ("name", "value"),
    [
        ("UOK_DB_POOL_SIZE", "0"),
        ("UOK_DB_POOL_SIZE", "unbounded"),
        ("UOK_DB_MAX_OVERFLOW", "101"),
        ("UOK_DB_POOL_TIMEOUT_SECONDS", "0"),
        ("UOK_DB_POOL_TIMEOUT_SECONDS", "301"),
        ("UOK_DB_POOL_PRE_PING", "sometimes"),
        ("UOK_DB_POOL_RECYCLE_SECONDS", "29"),
        ("UOK_DB_POOL_RECYCLE_SECONDS", "86401"),
        ("UOK_DB_CONNECT_TIMEOUT_SECONDS", "0"),
        ("UOK_DB_CONNECT_TIMEOUT_SECONDS", "61"),
        ("UOK_DB_APPLICATION_NAME", ""),
        ("UOK_DB_APPLICATION_NAME", "uok api"),
    ],
)
def test_postgresql_pool_settings_reject_invalid_values(name: str, value: str) -> None:
    with pytest.raises(RuntimeError, match=name):
        PostgresPoolSettings.from_env({name: value})


def test_postgresql_pool_settings_reject_unbounded_process_capacity() -> None:
    with pytest.raises(RuntimeError, match="must not exceed 100"):
        PostgresPoolSettings.from_env({"UOK_DB_POOL_SIZE": "60", "UOK_DB_MAX_OVERFLOW": "50"})


def test_sqlite_behavior_is_preserved_and_instrumented() -> None:
    engine, telemetry = create_database_engine("sqlite:///:memory:", {})
    try:
        with engine.connect() as connection:
            assert connection.scalar(text("select 1")) == 1
        snapshot = telemetry.snapshot()
        assert snapshot["backend"] == "sqlite"
        assert snapshot["configuration"] is None
        assert snapshot["runtime"]["checkouts_total"] == 1
        assert snapshot["runtime"]["checkins_total"] == 1
        assert snapshot["runtime"]["checked_out"] == 0
    finally:
        engine.dispose()


def test_bounded_queue_pool_times_out_then_recovers_after_release() -> None:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        max_overflow=0,
        pool_size=1,
        pool_timeout=0.05,
        poolclass=QueuePool,
    )
    try:
        with engine.connect():
            started = monotonic()
            with pytest.raises(SQLAlchemyTimeoutError):
                engine.connect()
            assert monotonic() - started < 1

        with engine.connect() as released_connection:
            assert released_connection.scalar(text("select 1")) == 1
    finally:
        engine.dispose()


def test_postgresql_snapshot_never_exposes_database_credentials() -> None:
    engine, telemetry = create_database_engine(
        "postgresql+psycopg://pool_user:super-secret@example.test/uok",
        {},
    )
    try:
        rendered = json.dumps(telemetry.snapshot(), sort_keys=True)
        assert "pool_user" not in rendered
        assert "super-secret" not in rendered
        assert "example.test" not in rendered
    finally:
        engine.dispose()


def test_process_local_telemetry_updates_are_thread_safe() -> None:
    telemetry = DatabasePoolTelemetry("postgresql", "QueuePool", {})
    with ThreadPoolExecutor(max_workers=8) as executor:
        list(executor.map(lambda _: telemetry.record_timeout(), range(1_000)))
    assert telemetry.snapshot()["runtime"]["timeouts_total"] == 1_000


def test_database_pool_timeout_response_is_generic_and_retryable() -> None:
    assert main.app.exception_handlers[SQLAlchemyTimeoutError] is main.database_pool_timeout_handler
    before = main.database_pool_telemetry.snapshot()["runtime"]["timeouts_total"]
    request = Request({"type": "http", "method": "GET", "path": "/", "headers": []})
    response = main.database_pool_timeout_handler(
        request,
        SQLAlchemyTimeoutError("sensitive database pool diagnostics"),
    )

    assert response.status_code == 503
    assert response.headers["retry-after"] == "1"
    assert b"sensitive" not in response.body
    assert main.database_pool_telemetry.snapshot()["runtime"]["timeouts_total"] == before + 1


def test_lifespan_always_disposes_the_engine(monkeypatch: pytest.MonkeyPatch) -> None:
    disposed = []
    monkeypatch.setattr(main, "bootstrap", lambda: "")
    monkeypatch.setattr(main.engine, "dispose", lambda: disposed.append(True))

    async def exercise() -> None:
        async with main.lifespan(main.app):
            raise RuntimeError("lifespan failure")

    with pytest.raises(RuntimeError, match="lifespan failure"):
        asyncio.run(exercise())
    assert disposed == [True]


def test_database_pool_status_requires_architecture_permission(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    viewer = auth(client, "viewer", "viewer123")

    unauthenticated = client.get("/api/architecture/database-pool")
    assert unauthenticated.status_code == 401, unauthenticated.text

    allowed = client.get("/api/architecture/database-pool", headers=admin)
    assert allowed.status_code == 200, allowed.text
    assert allowed.json()["scope"] == "process"
    assert "DATABASE_URL" not in allowed.text

    denied = client.get("/api/architecture/database-pool", headers=viewer)
    assert denied.status_code == 403, denied.text

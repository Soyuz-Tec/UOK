from __future__ import annotations

import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest


SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import database_capacity_live as live  # noqa: E402
import verify_database_capacity as capacity  # noqa: E402


LIVE_LIMITS = {
    "max_connections": 100,
    "superuser_reserved_connections": 3,
    "reserved_connections": 0,
}


class _Result:
    def __init__(self, value: object) -> None:
        self.value = value

    def mappings(self) -> _Result:
        return self

    def one(self) -> object:
        return self.value

    def all(self) -> object:
        return self.value

    def scalar_one(self) -> object:
        return self.value


class _Context:
    def __init__(self, value: object) -> None:
        self.value = value

    def __enter__(self) -> object:
        return self.value

    def __exit__(self, *_args: object) -> None:
        return None


class _Connection:
    def __init__(self) -> None:
        self.statements: list[str] = []

    def begin(self) -> _Context:
        return _Context(None)

    def exec_driver_sql(self, statement: str) -> _Result:
        self.statements.append(statement)
        if statement == live.CAPACITY_SQL:
            return _Result(LIVE_LIMITS)
        if statement == live.ROLE_SQL:
            return _Result(True)
        if statement == live.SESSIONS_SQL:
            return _Result([
                {
                    "database_name": "uok",
                    "application_name": "uok-api",
                    "state": "idle",
                    "count": 5,
                }
            ])
        return _Result(None)


class _Engine:
    def __init__(self, dialect: str = "postgresql") -> None:
        self.dialect = SimpleNamespace(name=dialect)
        self.connection = _Connection()
        self.disposed = False

    def connect(self) -> _Context:
        return _Context(self.connection)

    def dispose(self) -> None:
        self.disposed = True


def test_live_inspection_is_read_only_grouped_and_disposes_engine() -> None:
    engine = _Engine()
    options: dict[str, object] = {}

    def factory(*_args: object, **kwargs: object) -> _Engine:
        options.update(kwargs)
        return engine

    observations = capacity.inspect_live_database(
        "postgresql+psycopg://ignored",
        connect_timeout_seconds=7,
        engine_factory=factory,
    )
    assert engine.connection.statements[0] == "SET TRANSACTION READ ONLY"
    assert "backend_type = 'client backend'" in live.SESSIONS_SQL
    assert "pid <> pg_backend_pid()" in live.SESSIONS_SQL
    assert options["poolclass"] is live.NullPool
    assert options["connect_args"] == {
        "application_name": "uok-capacity-verifier",
        "connect_timeout": 7,
    }
    assert observations["limits"]["max_connections"] == 100
    assert observations["is_superuser"] is True
    assert observations["sessions"] == [
        {"database": "uok", "application_name": "uok-api", "state": "idle", "count": 5}
    ]
    assert engine.disposed is True


def test_live_cli_reports_superuser_warning_without_database_url(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(
        capacity,
        "inspect_live_database",
        lambda _url, **_kwargs: {
            "limits": LIVE_LIMITS,
            "is_superuser": True,
            "sessions": [
                {"database": "uok", "application_name": "uok-api", "state": "idle", "count": 5}
            ],
        },
    )
    database_url = "postgresql+psycopg://uok:do-not-print@db/uok"
    exit_code = capacity.main(["--live"], environment={"DATABASE_URL": database_url})
    output = capsys.readouterr().out
    report = json.loads(output)
    assert exit_code == 0
    assert report["live_observations"]["role"]["warning"] == capacity.SUPERUSER_WARNING
    assert report["live_observations"]["sessions_by_database_application_name_and_state"][0][
        "count"
    ] == 5
    assert "do-not-print" not in output


def test_live_capacity_uses_configured_application_name(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(
        capacity,
        "inspect_live_database",
        lambda _url, **_kwargs: {
            "limits": LIVE_LIMITS,
            "is_superuser": False,
            "sessions": [
                {"database": "uok", "application_name": "custom-api", "state": "idle", "count": 5}
            ],
        },
    )
    exit_code = capacity.main(
        ["--live"],
        environment={
            "DATABASE_URL": "postgresql+psycopg://unused",
            "UOK_DB_APPLICATION_NAME": "custom-api",
        },
    )
    report = json.loads(capsys.readouterr().out)
    assert exit_code == 0
    assert report["live_observations"]["session_counts"]["uok_api"] == 5
    assert report["live_observations"]["uok_application_name"] == "custom-api"


@pytest.mark.parametrize(
    ("sessions", "failed_check"),
    [
        ([{"application_name": "uok-api", "count": 16}], "uok_api_sessions_within_declared_demand"),
        ([{"application_name": "other-api", "count": 16}], "non_uok_sessions_within_direct_tools_reserve"),
    ],
)
def test_live_capacity_rejects_observed_demand_breaches(
    sessions: list[dict[str, object]], failed_check: str
) -> None:
    assessment = live.evaluate_live_capacity(
        sessions,
        uok_application_name="uok-api",
        usable_connections=97,
        application_pool_demand=15,
        direct_tools_reserve=15,
        operational_headroom=20,
    )
    assert assessment["ok"] is False
    assert assessment["checks"][failed_check]["ok"] is False


def test_live_capacity_requires_actual_operational_headroom() -> None:
    assessment = live.evaluate_live_capacity(
        [{"application_name": "uok-api", "count": 11}],
        uok_application_name="uok-api",
        usable_connections=30,
        application_pool_demand=20,
        direct_tools_reserve=15,
        operational_headroom=20,
    )
    assert assessment["checks"]["operational_headroom_preserved"]["ok"] is False
    assert assessment["ok"] is False


def test_live_inspection_rejects_non_postgresql_and_disposes_engine() -> None:
    engine = _Engine(dialect="sqlite")
    with pytest.raises(capacity.LiveInspectionError, match="requires PostgreSQL"):
        capacity.inspect_live_database(
            "sqlite:///:memory:",
            connect_timeout_seconds=5,
            engine_factory=lambda *_args, **_kwargs: engine,
        )
    assert engine.disposed is True

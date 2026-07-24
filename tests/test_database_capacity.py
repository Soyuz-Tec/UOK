from __future__ import annotations

import json
import sys
from pathlib import Path
import pytest


SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import verify_database_capacity as capacity  # noqa: E402


LIVE_LIMITS = {
    "max_connections": 100,
    "superuser_reserved_connections": 3,
    "reserved_connections": 0,
}
DEFAULTS = {
    **LIVE_LIMITS,
    "pool_size": 5,
    "max_overflow": 10,
    "workers": 1,
    "replicas": 1,
    "direct_tools_reserve": 15,
    "operational_headroom": 20,
}


def test_default_budget_calculation_preserves_reserves() -> None:
    report = capacity.calculate_capacity(**DEFAULTS)
    assert report["usable_connections"] == 97
    assert report["application_pool_demand"] == 15
    assert report["total_demand"] == 50
    assert report["remaining_after_demand"] == 47
    assert report["ok"] is True


def test_budget_fails_when_worker_and_replica_demand_exceeds_capacity() -> None:
    values = {**DEFAULTS, "workers": 4, "replicas": 2}
    report = capacity.calculate_capacity(**values)
    assert report["application_pool_demand"] == 120
    assert report["total_demand"] == 155
    assert report["remaining_after_demand"] == -58
    assert report["ok"] is False


@pytest.mark.parametrize(
    ("name", "value"),
    [
        ("pool_size", 0),
        ("max_overflow", -1),
        ("workers", 0),
        ("replicas", 1_000_001),
        ("direct_tools_reserve", 1.5),
        ("operational_headroom", True),
    ],
)
def test_budget_rejects_invalid_or_unbounded_inputs(name: str, value: object) -> None:
    values = {**DEFAULTS, name: value}
    with pytest.raises(capacity.CapacityConfigurationError):
        capacity.calculate_capacity(**values)


def test_budget_rejects_reservations_that_consume_database_capacity() -> None:
    values = {
        **DEFAULTS,
        "max_connections": 5,
        "superuser_reserved_connections": 3,
        "reserved_connections": 2,
    }
    with pytest.raises(capacity.CapacityConfigurationError, match="no usable capacity"):
        capacity.calculate_capacity(**values)


@pytest.mark.parametrize(
    ("name", "value"),
    [
        ("direct_tools_reserve", 14),
        ("operational_headroom", 19),
    ],
)
def test_budget_enforces_mandatory_reserve_floors(name: str, value: int) -> None:
    with pytest.raises(capacity.CapacityConfigurationError):
        capacity.calculate_capacity(**{**DEFAULTS, name: value})


def test_budget_matches_application_per_process_limit() -> None:
    with pytest.raises(capacity.CapacityConfigurationError, match="must not exceed 100"):
        capacity.calculate_capacity(**{**DEFAULTS, "pool_size": 60, "max_overflow": 50})


def test_offline_cli_is_deterministic_and_credential_free(capsys: pytest.CaptureFixture[str]) -> None:
    environment = {"DATABASE_URL": "postgresql+psycopg://user:secret@db/uok"}
    exit_code = capacity.main([], environment=environment)
    output = capsys.readouterr().out
    report = json.loads(output)
    assert exit_code == 0
    assert report["mode"] == "offline"
    assert report["capacity"]["total_demand"] == 50
    assert report["live_observations"]["queried"] is False
    assert report["configuration"]["pool_pre_ping"] is True
    assert report["configuration"]["connect_timeout_seconds"] == 5
    assert "secret" not in output
    assert "DATABASE_URL" not in output


def test_cli_returns_json_error_for_unbounded_pool(capsys: pytest.CaptureFixture[str]) -> None:
    exit_code = capacity.main(["--max-overflow", "-1"], environment={})
    report = json.loads(capsys.readouterr().out)
    assert exit_code == 2
    assert report["status"] == "error"
    assert report["error"]["code"] == "invalid_configuration"


def test_environment_file_overrides_ambient_and_cli_overrides_file(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    policy = tmp_path / "capacity.env"
    policy.write_text(
        "UOK_DB_POOL_SIZE=4\nUOK_DB_MAX_OVERFLOW=1\n"
        "UOK_DB_MAX_CONNECTIONS=100\nUOK_DB_APPLICATION_NAME=policy-api\n",
        encoding="utf-8",
    )
    exit_code = capacity.main(
        ["--environment-file", str(policy), "--pool-size", "6"],
        environment={"UOK_DB_POOL_SIZE": "99", "UOK_DB_APPLICATION_NAME": "ambient-api"},
    )
    report = json.loads(capsys.readouterr().out)
    assert exit_code == 0
    assert report["configuration"]["pool_size"] == 6
    assert report["configuration"]["max_overflow"] == 1
    assert report["configuration"]["application_name"] == "policy-api"


@pytest.mark.parametrize(
    "contents",
    [
        "UNKNOWN_SETTING=1\n",
        "UOK_DB_POOL_SIZE=5\nUOK_DB_POOL_SIZE=6\n",
        "UOK_DB_POOL_SIZE\n",
        "UOK_DB_POOL_SIZE=+5\n",
    ],
)
def test_environment_file_rejects_unknown_duplicate_or_malformed_lines(
    contents: str, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    policy = tmp_path / "invalid.env"
    policy.write_text(contents, encoding="utf-8")
    assert capacity.main(["--environment-file", str(policy)], environment={}) == 2
    assert json.loads(capsys.readouterr().out)["status"] == "error"


@pytest.mark.parametrize(
    ("name", "value"),
    [
        ("UOK_DB_POOL_TIMEOUT_SECONDS", "0"),
        ("UOK_DB_POOL_PRE_PING", "sometimes"),
        ("UOK_DB_POOL_RECYCLE_SECONDS", "29"),
        ("UOK_DB_APPLICATION_NAME", "uok api"),
        ("UOK_DB_CONNECT_TIMEOUT_SECONDS", "61"),
    ],
)
def test_offline_gate_validates_runtime_pool_fields(
    name: str, value: str, capsys: pytest.CaptureFixture[str]
) -> None:
    assert capacity.main([], environment={name: value}) == 2
    assert json.loads(capsys.readouterr().out)["status"] == "error"


def test_live_mode_rejects_offline_database_limit_flags(
    capsys: pytest.CaptureFixture[str],
) -> None:
    exit_code = capacity.main(
        ["--live", "--max-connections", "99"],
        environment={"DATABASE_URL": "postgresql+psycopg://unused"},
    )
    report = json.loads(capsys.readouterr().out)
    assert exit_code == 2
    assert report["error"]["message"] == "database limit overrides are offline-only"

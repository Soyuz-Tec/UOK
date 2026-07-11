from __future__ import annotations

import re
from collections.abc import Callable, Collection, Mapping
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool


VERIFIER_APPLICATION_NAME = "uok-capacity-verifier"
MAX_ENVIRONMENT_FILE_BYTES = 64 * 1024
APPLICATION_NAME_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,62}")
DEPLOY_FILE_EXTRA_KEYS = {
    "UOK_DB_APPLICATION_NAME",
    "UOK_DB_POOL_PRE_PING",
    "UOK_DB_POOL_RECYCLE_SECONDS",
    "UOK_DB_POOL_TIMEOUT_SECONDS",
}

CAPACITY_SQL = """
SELECT
    current_setting('max_connections')::integer AS max_connections,
    current_setting('superuser_reserved_connections')::integer
        AS superuser_reserved_connections,
    COALESCE(current_setting('reserved_connections', true), '0')::integer
        AS reserved_connections
"""
ROLE_SQL = "SELECT rolsuper FROM pg_roles WHERE rolname = current_user"
SESSIONS_SQL = """
SELECT
    COALESCE(datname, '<none>') AS database_name,
    COALESCE(NULLIF(application_name, ''), '<unset>') AS application_name,
    COALESCE(state, 'unknown') AS state,
    count(*)::integer AS count
FROM pg_stat_activity
WHERE backend_type = 'client backend'
  AND pid <> pg_backend_pid()
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3
"""


class LiveInspectionError(RuntimeError):
    pass


class DeployConfigurationError(ValueError):
    pass


def _bounded_int(name: str, value: str, minimum: int, maximum: int) -> int:
    raw = value.strip()
    if not raw.isdecimal():
        raise DeployConfigurationError(f"{name} must be a bounded integer")
    parsed = int(raw)
    if not minimum <= parsed <= maximum:
        raise DeployConfigurationError(f"{name} must be between {minimum} and {maximum}")
    return parsed


def _boolean(name: str, value: str) -> bool:
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise DeployConfigurationError(f"{name} must be true or false")


def _recycle(value: str) -> int | None:
    raw = value.strip()
    if raw in {"-1", "0"}:
        return None
    return _bounded_int("UOK_DB_POOL_RECYCLE_SECONDS", raw, 30, 86_400)


def read_environment_file(filename: str, allowed_keys: Collection[str]) -> dict[str, str]:
    try:
        path = Path(filename)
        if not path.is_file() or path.stat().st_size > MAX_ENVIRONMENT_FILE_BYTES:
            raise DeployConfigurationError("environment file is missing or exceeds its size limit")
        lines = path.read_text(encoding="utf-8-sig").splitlines()
    except DeployConfigurationError:
        raise
    except (OSError, UnicodeError) as error:
        raise DeployConfigurationError("environment file could not be read") from error
    values: dict[str, str] = {}
    for line_number, line in enumerate(lines, start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.count("=") != 1:
            raise DeployConfigurationError(f"environment file line {line_number} is malformed")
        name, value = (part.strip() for part in stripped.split("=", 1))
        if not re.fullmatch(r"[A-Z][A-Z0-9_]*", name) or not value:
            raise DeployConfigurationError(f"environment file line {line_number} is malformed")
        if name not in allowed_keys:
            raise DeployConfigurationError(f"environment file key {name} is not permitted")
        if name in values:
            raise DeployConfigurationError(f"environment file key {name} is duplicated")
        values[name] = value
    return values


def merge_environment(
    filename: str | None,
    ambient: Mapping[str, str],
    allowed_keys: Collection[str],
) -> dict[str, str]:
    merged = dict(ambient)
    if filename is not None:
        merged.update(read_environment_file(filename, allowed_keys))
    return merged


def runtime_configuration(
    environment: Mapping[str, str], application_name_override: str | None
) -> dict[str, Any]:
    application_name = application_name_override
    if application_name is None:
        application_name = environment.get("UOK_DB_APPLICATION_NAME", "uok-api")
    application_name = application_name.strip()
    if not APPLICATION_NAME_PATTERN.fullmatch(application_name):
        raise DeployConfigurationError("UOK_DB_APPLICATION_NAME is invalid")
    return {
        "application_name": application_name,
        "pool_timeout_seconds": _bounded_int(
            "UOK_DB_POOL_TIMEOUT_SECONDS",
            environment.get("UOK_DB_POOL_TIMEOUT_SECONDS", "30"), 1, 300,
        ),
        "pool_pre_ping": _boolean(
            "UOK_DB_POOL_PRE_PING", environment.get("UOK_DB_POOL_PRE_PING", "1")
        ),
        "pool_recycle_seconds": _recycle(
            environment.get("UOK_DB_POOL_RECYCLE_SECONDS", "0")
        ),
    }


def _default_engine_factory(database_url: str, **options: object) -> Any:
    return create_engine(database_url, **options)


def _connect_timeout(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= 60:
        raise LiveInspectionError("live connect timeout must be between 1 and 60 seconds")
    return value


def _session_rows(rows: list[Any]) -> list[dict[str, str | int]]:
    sessions: list[dict[str, str | int]] = []
    for row in rows:
        count = row["count"]
        if isinstance(count, bool) or not isinstance(count, int) or count < 0:
            raise LiveInspectionError("PostgreSQL returned an invalid session observation")
        sessions.append(
            {
                "database": str(row["database_name"]),
                "application_name": str(row["application_name"]),
                "state": str(row["state"]),
                "count": count,
            }
        )
    return sessions


def inspect_live_database(
    database_url: str,
    *,
    connect_timeout_seconds: int,
    engine_factory: Callable[..., Any] | None = None,
) -> dict[str, Any]:
    if not database_url.strip():
        raise LiveInspectionError("DATABASE_URL is required for live inspection")
    timeout = _connect_timeout(connect_timeout_seconds)
    factory = engine_factory or _default_engine_factory
    engine = None
    try:
        engine = factory(
            database_url,
            future=True,
            poolclass=NullPool,
            connect_args={
                "application_name": VERIFIER_APPLICATION_NAME,
                "connect_timeout": timeout,
            },
        )
        if getattr(getattr(engine, "dialect", None), "name", None) != "postgresql":
            raise LiveInspectionError("live inspection requires PostgreSQL")
        with engine.connect() as connection:
            with connection.begin():
                connection.exec_driver_sql("SET TRANSACTION READ ONLY")
                limits = dict(connection.exec_driver_sql(CAPACITY_SQL).mappings().one())
                is_superuser = connection.exec_driver_sql(ROLE_SQL).scalar_one()
                rows = connection.exec_driver_sql(SESSIONS_SQL).mappings().all()
        if not isinstance(is_superuser, bool):
            raise LiveInspectionError("PostgreSQL returned an invalid role observation")
        return {
            "limits": limits,
            "is_superuser": is_superuser,
            "sessions": _session_rows(rows),
        }
    except LiveInspectionError:
        raise
    except Exception as error:
        raise LiveInspectionError("live database inspection failed") from error
    finally:
        if engine is not None:
            try:
                engine.dispose()
            except Exception as error:
                raise LiveInspectionError("live database cleanup failed") from error


def evaluate_live_capacity(
    sessions: list[dict[str, Any]],
    *,
    uok_application_name: str,
    usable_connections: int,
    application_pool_demand: int,
    direct_tools_reserve: int,
    operational_headroom: int,
) -> dict[str, Any]:
    total = sum(int(row["count"]) for row in sessions)
    uok_api = sum(
        int(row["count"])
        for row in sessions
        if row["application_name"] == uok_application_name
    )
    non_uok = total - uok_api
    remaining = usable_connections - total
    checks = {
        "uok_api_sessions_within_declared_demand": {
            "ok": uok_api <= application_pool_demand,
            "observed": uok_api,
            "limit": application_pool_demand,
        },
        "non_uok_sessions_within_direct_tools_reserve": {
            "ok": non_uok <= direct_tools_reserve,
            "observed": non_uok,
            "limit": direct_tools_reserve,
        },
        "operational_headroom_preserved": {
            "ok": remaining >= operational_headroom,
            "observed_remaining_ordinary_slots": remaining,
            "minimum": operational_headroom,
        },
    }
    return {
        "ok": all(bool(check["ok"]) for check in checks.values()),
        "uok_application_name": uok_application_name,
        "session_counts": {
            "total_client_backends": total,
            "uok_api": uok_api,
            "non_uok": non_uok,
            "actual_remaining_ordinary_slots": remaining,
        },
        "checks": checks,
    }

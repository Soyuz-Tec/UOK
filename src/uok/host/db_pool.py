from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass
from threading import Lock
from typing import Any

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine, make_url


MAX_PROCESS_CONNECTIONS = 100
APPLICATION_NAME_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,62}")


def _bounded_integer(
    environ: Mapping[str, str],
    name: str,
    default: int,
    minimum: int,
    maximum: int,
) -> int:
    raw = environ.get(name, str(default)).strip()
    if not raw.isdecimal():
        raise RuntimeError(f"{name} must be an integer between {minimum} and {maximum}")
    value = int(raw)
    if not minimum <= value <= maximum:
        raise RuntimeError(f"{name} must be between {minimum} and {maximum}")
    return value


def _boolean(environ: Mapping[str, str], name: str, default: bool) -> bool:
    raw = environ.get(name, str(default)).strip().lower()
    if raw in {"1", "true", "yes", "on"}:
        return True
    if raw in {"0", "false", "no", "off"}:
        return False
    raise RuntimeError(f"{name} must be true or false")


def _optional_recycle_seconds(environ: Mapping[str, str]) -> int | None:
    name = "UOK_DB_POOL_RECYCLE_SECONDS"
    raw = environ.get(name)
    if raw is None:
        return None
    raw = raw.strip()
    if raw in {"-1", "0"}:
        return None
    if not raw.isdecimal():
        raise RuntimeError(f"{name} must be -1, 0, or an integer between 30 and 86400")
    value = int(raw)
    if not 30 <= value <= 86_400:
        raise RuntimeError(f"{name} must be -1, 0, or between 30 and 86400")
    return value


@dataclass(frozen=True)
class PostgresPoolSettings:
    pool_size: int
    max_overflow: int
    pool_timeout_seconds: int
    pool_pre_ping: bool
    pool_recycle_seconds: int | None
    connect_timeout_seconds: int
    application_name: str

    @classmethod
    def from_env(cls, environ: Mapping[str, str]) -> PostgresPoolSettings:
        settings = cls(
            pool_size=_bounded_integer(environ, "UOK_DB_POOL_SIZE", 5, 1, 100),
            max_overflow=_bounded_integer(environ, "UOK_DB_MAX_OVERFLOW", 10, 0, 100),
            pool_timeout_seconds=_bounded_integer(environ, "UOK_DB_POOL_TIMEOUT_SECONDS", 30, 1, 300),
            pool_pre_ping=_boolean(environ, "UOK_DB_POOL_PRE_PING", True),
            pool_recycle_seconds=_optional_recycle_seconds(environ),
            connect_timeout_seconds=_bounded_integer(environ, "UOK_DB_CONNECT_TIMEOUT_SECONDS", 5, 1, 60),
            application_name=environ.get("UOK_DB_APPLICATION_NAME", "uok-api").strip(),
        )
        if settings.pool_size + settings.max_overflow > MAX_PROCESS_CONNECTIONS:
            raise RuntimeError(
                "UOK_DB_POOL_SIZE + UOK_DB_MAX_OVERFLOW must not exceed "
                f"{MAX_PROCESS_CONNECTIONS} connections per process"
            )
        if not APPLICATION_NAME_PATTERN.fullmatch(settings.application_name):
            raise RuntimeError(
                "UOK_DB_APPLICATION_NAME must be 1-63 ASCII letters, digits, dots, colons, "
                "underscores, or hyphens and must start with a letter or digit"
            )
        return settings

    def engine_options(self) -> dict[str, Any]:
        return {
            "connect_args": {
                "application_name": self.application_name,
                "connect_timeout": self.connect_timeout_seconds,
            },
            "max_overflow": self.max_overflow,
            "pool_pre_ping": self.pool_pre_ping,
            "pool_recycle": self.pool_recycle_seconds if self.pool_recycle_seconds is not None else -1,
            "pool_size": self.pool_size,
            "pool_timeout": self.pool_timeout_seconds,
        }

    def public_snapshot(self) -> dict[str, Any]:
        return {
            "application_name": self.application_name,
            "connect_timeout_seconds": self.connect_timeout_seconds,
            "max_overflow": self.max_overflow,
            "pool_pre_ping": self.pool_pre_ping,
            "pool_recycle_seconds": self.pool_recycle_seconds,
            "pool_size": self.pool_size,
            "pool_timeout_seconds": self.pool_timeout_seconds,
        }


class DatabasePoolTelemetry:
    def __init__(
        self,
        backend: str,
        pool_class: str,
        configuration: dict[str, Any] | None,
    ) -> None:
        self._backend = backend
        self._pool_class = pool_class
        self._configuration = configuration
        self._lock = Lock()
        self._counters = {
            "connections_opened_total": 0,
            "connections_closed_total": 0,
            "checkouts_total": 0,
            "checkins_total": 0,
            "invalidations_total": 0,
            "timeouts_total": 0,
            "checked_out": 0,
            "peak_checked_out": 0,
        }

    def instrument(self, engine: Engine) -> None:
        event.listen(engine.pool, "connect", self._connection_opened)
        event.listen(engine.pool, "close", self._connection_closed)
        event.listen(engine.pool, "checkout", self._checkout)
        event.listen(engine.pool, "checkin", self._checkin)
        event.listen(engine.pool, "invalidate", self._invalidate)

    def _connection_opened(self, *_: object) -> None:
        self._increment("connections_opened_total")

    def _connection_closed(self, *_: object) -> None:
        self._increment("connections_closed_total")

    def _checkout(self, *_: object) -> None:
        with self._lock:
            self._counters["checkouts_total"] += 1
            self._counters["checked_out"] += 1
            self._counters["peak_checked_out"] = max(
                self._counters["peak_checked_out"],
                self._counters["checked_out"],
            )

    def _checkin(self, *_: object) -> None:
        with self._lock:
            self._counters["checkins_total"] += 1
            self._counters["checked_out"] = max(0, self._counters["checked_out"] - 1)

    def _invalidate(self, *_: object) -> None:
        self._increment("invalidations_total")

    def record_timeout(self) -> None:
        self._increment("timeouts_total")

    def _increment(self, name: str) -> None:
        with self._lock:
            self._counters[name] += 1

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            runtime = dict(self._counters)
        configuration = dict(self._configuration) if self._configuration is not None else None
        return {
            "backend": self._backend,
            "configuration": configuration,
            "pool_class": self._pool_class,
            "runtime": runtime,
            "scope": "process",
        }


def create_database_engine(
    database_url: str,
    environ: Mapping[str, str],
) -> tuple[Engine, DatabasePoolTelemetry]:
    backend = make_url(database_url).get_backend_name()
    options: dict[str, Any] = {"future": True}
    configuration = None
    if backend == "sqlite":
        options["connect_args"] = {"check_same_thread": False}
    elif backend == "postgresql":
        settings = PostgresPoolSettings.from_env(environ)
        options.update(settings.engine_options())
        configuration = settings.public_snapshot()
    engine = create_engine(database_url, **options)
    telemetry = DatabasePoolTelemetry(backend, type(engine.pool).__name__, configuration)
    telemetry.instrument(engine)
    return engine, telemetry

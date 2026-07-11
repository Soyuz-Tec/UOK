from __future__ import annotations

import argparse
import json
import os
import sys
from collections.abc import Mapping, Sequence
from typing import Any

from database_capacity_live import (
    DEPLOY_FILE_EXTRA_KEYS,
    DeployConfigurationError,
    LiveInspectionError,
    evaluate_live_capacity,
    inspect_live_database,
    merge_environment,
    runtime_configuration,
)


SCHEMA = "uok.database_capacity.v1"
MAX_INPUT_VALUE = 1_000_000
MAX_PROCESS_CONNECTIONS = 100
SUPERUSER_WARNING = "The database check is using a superuser role; use a least-privileged app role."

OptionSpec = tuple[str, str, str, int, int, int]
PLAN_SPECS: tuple[OptionSpec, ...] = (
    ("pool_size", "--pool-size", "UOK_DB_POOL_SIZE", 5, 1, MAX_INPUT_VALUE),
    ("max_overflow", "--max-overflow", "UOK_DB_MAX_OVERFLOW", 10, 0, MAX_INPUT_VALUE),
    ("workers", "--workers", "UOK_API_WORKERS", 1, 1, MAX_INPUT_VALUE),
    ("replicas", "--replicas", "UOK_API_REPLICAS", 1, 1, MAX_INPUT_VALUE),
    ("direct_tools_reserve", "--direct-tools-reserve", "UOK_DB_DIRECT_TOOLS_RESERVE", 15, 15, MAX_INPUT_VALUE),
    ("operational_headroom", "--operational-headroom", "UOK_DB_OPERATIONAL_HEADROOM", 20, 20, MAX_INPUT_VALUE),
)
LIMIT_SPECS: tuple[OptionSpec, ...] = (
    ("max_connections", "--max-connections", "UOK_DB_MAX_CONNECTIONS", 100, 1, MAX_INPUT_VALUE),
    ("superuser_reserved_connections", "--superuser-reserved-connections", "UOK_DB_SUPERUSER_RESERVED_CONNECTIONS", 3, 0, MAX_INPUT_VALUE),
    ("reserved_connections", "--reserved-connections", "UOK_DB_RESERVED_CONNECTIONS", 0, 0, MAX_INPUT_VALUE),
)
LIVE_SPECS: tuple[OptionSpec, ...] = (
    ("connect_timeout_seconds", "--connect-timeout-seconds", "UOK_DB_CONNECT_TIMEOUT_SECONDS", 5, 1, 60),
)
ENVIRONMENT_FILE_KEYS = {spec[2] for spec in PLAN_SPECS + LIMIT_SPECS + LIVE_SPECS}
ENVIRONMENT_FILE_KEYS |= DEPLOY_FILE_EXTRA_KEYS


class CapacityConfigurationError(ValueError):
    pass


class JsonArgumentParser(argparse.ArgumentParser):
    def error(self, _message: str) -> None:
        raise CapacityConfigurationError("invalid command-line arguments")


def _validated_int(name: str, value: object, minimum: int, maximum: int) -> int:
    if isinstance(value, bool):
        raise CapacityConfigurationError(f"{name} must be a bounded integer")
    if isinstance(value, int):
        parsed = value
    elif isinstance(value, str) and value.strip().isdecimal():
        parsed = int(value)
    else:
        raise CapacityConfigurationError(f"{name} must be a bounded integer")
    if parsed < minimum or parsed > maximum:
        raise CapacityConfigurationError(f"{name} must be between {minimum} and {maximum}")
    return parsed


def _parser() -> JsonArgumentParser:
    parser = JsonArgumentParser(description="Verify the UOK PostgreSQL connection budget.")
    parser.add_argument("--live", action="store_true", help="Inspect PostgreSQL via DATABASE_URL.")
    parser.add_argument(
        "--environment-file",
        help="Read explicit non-secret deployment settings from a KEY=VALUE file.",
    )
    parser.add_argument("--application-name", help="Override UOK_DB_APPLICATION_NAME.")
    for destination, flag, environment_name, default, _minimum, _maximum in (
        PLAN_SPECS + LIMIT_SPECS + LIVE_SPECS
    ):
        suffix = " (offline only)" if destination in {spec[0] for spec in LIMIT_SPECS} else ""
        parser.add_argument(
            flag,
            dest=destination,
            help=f"Override {environment_name} (default: {default}){suffix}.",
        )
    return parser


def _read_values(
    args: argparse.Namespace,
    environment: Mapping[str, str],
    specs: tuple[OptionSpec, ...],
) -> dict[str, int]:
    values: dict[str, int] = {}
    for destination, _flag, environment_name, default, minimum, maximum in specs:
        command_value = getattr(args, destination)
        raw_value: object = command_value
        if command_value is None:
            raw_value = environment.get(environment_name, default)
        values[destination] = _validated_int(environment_name, raw_value, minimum, maximum)
    return values


def calculate_capacity(
    *,
    max_connections: object,
    superuser_reserved_connections: object,
    reserved_connections: object,
    pool_size: object,
    max_overflow: object,
    workers: object,
    replicas: object,
    direct_tools_reserve: object,
    operational_headroom: object,
) -> dict[str, int | bool]:
    limits = {
        "max_connections": _validated_int("max_connections", max_connections, 1, MAX_INPUT_VALUE),
        "superuser_reserved_connections": _validated_int(
            "superuser_reserved_connections", superuser_reserved_connections, 0, MAX_INPUT_VALUE
        ),
        "reserved_connections": _validated_int(
            "reserved_connections", reserved_connections, 0, MAX_INPUT_VALUE
        ),
    }
    plan = {
        "pool_size": _validated_int("pool_size", pool_size, 1, MAX_INPUT_VALUE),
        "max_overflow": _validated_int("max_overflow", max_overflow, 0, MAX_INPUT_VALUE),
        "workers": _validated_int("workers", workers, 1, MAX_INPUT_VALUE),
        "replicas": _validated_int("replicas", replicas, 1, MAX_INPUT_VALUE),
        "direct_tools_reserve": _validated_int(
            "direct_tools_reserve", direct_tools_reserve, 15, MAX_INPUT_VALUE
        ),
        "operational_headroom": _validated_int(
            "operational_headroom", operational_headroom, 20, MAX_INPUT_VALUE
        ),
    }
    if plan["pool_size"] + plan["max_overflow"] > MAX_PROCESS_CONNECTIONS:
        raise CapacityConfigurationError("pool_size + max_overflow must not exceed 100")
    usable = (
        limits["max_connections"]
        - limits["superuser_reserved_connections"]
        - limits["reserved_connections"]
    )
    if usable <= 0:
        raise CapacityConfigurationError("reserved connections leave no usable capacity")
    application_demand = (
        (plan["pool_size"] + plan["max_overflow"])
        * plan["workers"]
        * plan["replicas"]
    )
    demand = application_demand + plan["direct_tools_reserve"] + plan["operational_headroom"]
    return {
        **limits,
        "usable_connections": usable,
        "application_pool_demand": application_demand,
        "direct_tools_reserve": plan["direct_tools_reserve"],
        "operational_headroom": plan["operational_headroom"],
        "total_demand": demand,
        "remaining_after_demand": usable - demand,
        "ok": demand <= usable,
    }


def _live_assessment(
    capacity: dict[str, Any], observations: dict[str, Any], application_name: str
) -> dict[str, Any]:
    return evaluate_live_capacity(
        observations["sessions"],
        uok_application_name=application_name,
        usable_connections=int(capacity["usable_connections"]),
        application_pool_demand=int(capacity["application_pool_demand"]),
        direct_tools_reserve=int(capacity["direct_tools_reserve"]),
        operational_headroom=int(capacity["operational_headroom"]),
    )


def build_report(
    plan: dict[str, int],
    limits: dict[str, int],
    *,
    mode: str,
    live_observations: dict[str, Any] | None = None,
    connect_timeout_seconds: int | None = None,
    runtime_config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    capacity = calculate_capacity(**plan, **limits)
    runtime = runtime_config or {
        "application_name": "uok-api",
        "pool_timeout_seconds": 30,
        "pool_pre_ping": True,
        "pool_recycle_seconds": None,
    }
    application_name = runtime["application_name"]
    assessment = (
        None
        if live_observations is None
        else _live_assessment(capacity, live_observations, application_name)
    )
    is_superuser = None if live_observations is None else live_observations["is_superuser"]
    warning = SUPERUSER_WARNING if is_superuser else None
    sessions = [] if live_observations is None else live_observations["sessions"]
    ok = bool(capacity["ok"]) and (assessment is None or bool(assessment["ok"]))
    return {
        "schema": SCHEMA,
        "ok": ok,
        "status": "pass" if ok else "fail",
        "mode": mode,
        "formula": "demand=(pool_size+max_overflow)*workers*replicas+direct_tools_reserve+operational_headroom",
        "configuration": {
            **plan,
            **runtime,
            "connect_timeout_seconds": connect_timeout_seconds,
        },
        "capacity": capacity,
        "live_observations": {
            "queried": live_observations is not None,
            "connect_timeout_seconds": connect_timeout_seconds,
            "uok_application_name": application_name,
            "sessions_by_database_application_name_and_state": sessions,
            "session_counts": None if assessment is None else assessment["session_counts"],
            "checks": {} if assessment is None else assessment["checks"],
            "role": {"is_superuser": is_superuser, "warning": warning},
        },
        "warnings": [warning] if warning else [],
    }


def _error_report(mode: str, code: str, message: str) -> dict[str, Any]:
    return {
        "schema": SCHEMA, "ok": False, "status": "error", "mode": mode,
        "error": {"code": code, "message": message},
    }


def main(
    argv: Sequence[str] | None = None,
    *,
    environment: Mapping[str, str] | None = None,
) -> int:
    mode = "offline"
    try:
        args = _parser().parse_args(argv)
        mode = "live" if args.live else "offline"
        ambient = os.environ if environment is None else environment
        current_environment = merge_environment(
            args.environment_file, ambient, ENVIRONMENT_FILE_KEYS
        )
        plan = _read_values(args, current_environment, PLAN_SPECS)
        runtime_config = runtime_configuration(current_environment, args.application_name)
        live_config = _read_values(args, current_environment, LIVE_SPECS)
        connect_timeout_seconds = live_config["connect_timeout_seconds"]
        if args.live:
            if any(getattr(args, spec[0]) is not None for spec in LIMIT_SPECS):
                raise CapacityConfigurationError("database limit overrides are offline-only")
            observations = inspect_live_database(
                current_environment.get("DATABASE_URL", ""),
                connect_timeout_seconds=live_config["connect_timeout_seconds"],
            )
            limits = {
                name: _validated_int(name, observations["limits"][name], minimum, maximum)
                for name, _flag, _environment, _default, minimum, maximum in LIMIT_SPECS
            }
        else:
            observations = None
            limits = _read_values(args, current_environment, LIMIT_SPECS)
        report = build_report(
            plan,
            limits,
            mode=mode,
            live_observations=observations,
            connect_timeout_seconds=connect_timeout_seconds,
            runtime_config=runtime_config,
        )
        exit_code = 0 if report["ok"] else 1
    except (CapacityConfigurationError, DeployConfigurationError) as error:
        report = _error_report(mode, "invalid_configuration", str(error))
        exit_code = 2
    except LiveInspectionError as error:
        report = _error_report(mode, "live_inspection_failed", str(error))
        exit_code = 2
    print(json.dumps(report, indent=2, sort_keys=True))
    return exit_code


if __name__ == "__main__":
    sys.exit(main())

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = REPO_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from database_security_live import (  # noqa: E402
    LiveDatabaseSecurityError,
    inspect_live_database_security,
)
from database_security_evaluation import (  # noqa: E402
    evaluate_live_database_security,
)
from uok.database_security import SCHEMA, database_security_inventory  # noqa: E402


ROLE_NAME_PATTERN = re.compile(r"[a-z_][a-z0-9_]{0,62}")


class DatabaseSecurityConfigurationError(ValueError):
    pass


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Verify UOK PostgreSQL least privilege and tenant RLS coverage."
    )
    parser.add_argument("--live", action="store_true")
    parser.add_argument("--expect-active", action="store_true")
    parser.add_argument("--runtime-login-role")
    parser.add_argument("--migrator-login-role")
    parser.add_argument("--require-cross-org-probe", action="store_true")
    parser.add_argument("--connect-timeout-seconds", type=int, default=5)
    return parser


def _validated_arguments(argv: Sequence[str] | None) -> argparse.Namespace:
    args = _parser().parse_args(argv)
    if args.expect_active and not args.live:
        raise DatabaseSecurityConfigurationError("--expect-active requires --live")
    if args.require_cross_org_probe and not args.expect_active:
        raise DatabaseSecurityConfigurationError(
            "--require-cross-org-probe requires --expect-active"
        )
    if args.expect_active and not args.require_cross_org_probe:
        raise DatabaseSecurityConfigurationError(
            "--expect-active requires --require-cross-org-probe"
        )
    if args.runtime_login_role and not ROLE_NAME_PATTERN.fullmatch(
        args.runtime_login_role
    ):
        raise DatabaseSecurityConfigurationError("runtime login role is invalid")
    if args.migrator_login_role and not ROLE_NAME_PATTERN.fullmatch(
        args.migrator_login_role
    ):
        raise DatabaseSecurityConfigurationError("migrator login role is invalid")
    if args.expect_active and not args.runtime_login_role:
        raise DatabaseSecurityConfigurationError(
            "--runtime-login-role is required with --expect-active"
        )
    return args


def _security_report(
    args: argparse.Namespace,
    environment: Mapping[str, str] | None,
) -> dict[str, Any]:
    inventory = database_security_inventory()
    if not args.live:
        return {
            **inventory,
            "status": "pass" if inventory["ok"] else "fail",
            "mode": "offline",
            "foundation_ready": bool(inventory["ok"]),
        }
    current_environment = os.environ if environment is None else environment
    observations = inspect_live_database_security(
        current_environment.get("UOK_DATABASE_SECURITY_ADMIN_URL", ""),
        run_cross_org_probe=args.require_cross_org_probe,
        connect_timeout_seconds=args.connect_timeout_seconds,
    )
    return evaluate_live_database_security(
        inventory,
        observations,
        expect_active=args.expect_active,
        runtime_login_role=args.runtime_login_role,
        migrator_login_role=args.migrator_login_role,
        require_cross_org_probe=args.require_cross_org_probe,
    )


def main(
    argv: Sequence[str] | None = None,
    *,
    environment: Mapping[str, str] | None = None,
) -> int:
    try:
        report = _security_report(_validated_arguments(argv), environment)
        exit_code = 0 if report["ok"] else 1
    except DatabaseSecurityConfigurationError as error:
        report = _error_report("invalid_configuration", str(error))
        exit_code = 2
    except LiveDatabaseSecurityError as error:
        report = _error_report("live_inspection_failed", str(error))
        exit_code = 2
    print(json.dumps(report, indent=2, sort_keys=True))
    return exit_code


def _error_report(code: str, message: str) -> dict[str, Any]:
    return {
        "schema": SCHEMA,
        "ok": False,
        "status": "error",
        "error": {"code": code, "message": message},
    }


if __name__ == "__main__":
    sys.exit(main())

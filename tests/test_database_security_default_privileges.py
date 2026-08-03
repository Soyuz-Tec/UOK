from __future__ import annotations

import sys
from pathlib import Path

from uok.database_security import database_security_inventory


REPO_ROOT = Path(__file__).resolve().parents[1]
for support_path in (REPO_ROOT / "scripts", REPO_ROOT / "tests"):
    if str(support_path) not in sys.path:
        sys.path.insert(0, str(support_path))

import database_security_live as live  # noqa: E402
import verify_database_security as verifier  # noqa: E402
from database_security_test_support import (  # noqa: E402
    database_security_observations,
)


def _evaluate(observations: dict[str, object]) -> dict[str, object]:
    return verifier.evaluate_live_database_security(
        database_security_inventory(),
        observations,
        expect_active=False,
        runtime_login_role=None,
        migrator_login_role=None,
        require_cross_org_probe=False,
    )


def test_gate_rejects_default_privileges_in_the_wrong_schema() -> None:
    observations = database_security_observations(active=False)
    observations["default_privileges"][0]["schema_name"] = "shadow"

    report = _evaluate(observations)

    assert report["ok"] is False
    assert report["checks"]["runtime_default_privileges_are_closed"] is False


def test_gate_rejects_global_owner_default_privilege_drift() -> None:
    observations = database_security_observations(active=False)
    observations["default_privileges"].append(
        {
            "schema_name": "<global>",
            "owner_name": "uok_owner",
            "object_type": "r",
            "grantee_name": "PUBLIC",
            "privilege_type": "SELECT",
            "is_grantable": False,
        }
    )

    report = _evaluate(observations)

    assert report["ok"] is False
    assert report["checks"]["runtime_default_privileges_are_closed"] is False


def test_gate_rejects_arbitrary_global_default_grantee() -> None:
    observations = database_security_observations(active=False)
    observations["default_privileges"].append(
        {
            "schema_name": "<global>",
            "owner_name": "uok_owner",
            "object_type": "S",
            "grantee_name": "deployment_reader",
            "privilege_type": "USAGE",
            "is_grantable": False,
        }
    )

    report = _evaluate(observations)

    assert report["ok"] is False
    assert report["checks"]["runtime_default_privileges_are_closed"] is False


def test_default_privilege_inspection_includes_all_scopes() -> None:
    assert "LEFT JOIN pg_namespace" in live.DEFAULT_PRIVILEGE_SQL
    assert "COALESCE(namespace.nspname, '<global>')" in live.DEFAULT_PRIVILEGE_SQL
    assert "namespace.nspname = 'public'" not in live.DEFAULT_PRIVILEGE_SQL

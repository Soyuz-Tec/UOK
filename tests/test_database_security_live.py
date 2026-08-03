from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

from uok.database_security import database_security_inventory


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
TESTS = Path(__file__).resolve().parent
for support_path in (SCRIPTS, TESTS):
    if str(support_path) not in sys.path:
        sys.path.insert(0, str(support_path))

import database_security_live as live  # noqa: E402
import verify_database_security as verifier  # noqa: E402
from database_security_test_support import (  # noqa: E402
    database_security_observations,
)


def test_live_foundation_can_pass_without_claiming_production_readiness() -> None:
    report = verifier.evaluate_live_database_security(
        database_security_inventory(),
        database_security_observations(active=False),
        expect_active=False,
        runtime_login_role=None,
        migrator_login_role=None,
        require_cross_org_probe=False,
    )

    assert report["ok"] is True
    assert report["mode"] == "foundation"
    assert report["production_ready"] is False
    assert report["active_database_gate_ready"] is False
    assert report["checks"]["rls_disabled_and_unforced_for_all_tables"] is True
    assert "rls_enabled_and_forced_for_all_tenant_tables" not in report["checks"]


def test_active_gate_requires_all_policies_rls_login_and_guessed_id_proof() -> None:
    report = verifier.evaluate_live_database_security(
        database_security_inventory(),
        database_security_observations(active=True),
        expect_active=True,
        runtime_login_role="uok_app",
        migrator_login_role=None,
        require_cross_org_probe=True,
    )

    assert report["ok"] is True
    assert report["production_ready"] is False
    assert report["active_database_gate_ready"] is True
    assert report["checks"]["rls_enabled_and_forced_for_all_tenant_tables"] is True
    assert report["checks"]["rls_disabled_for_all_global_tables"] is True
    assert report["checks"]["runtime_login_is_safe_and_bounded"] is True
    assert report["checks"]["cross_organization_guessed_id_probe"] is True


def test_active_gate_fails_closed_for_missing_policy_or_elevated_login() -> None:
    observations = database_security_observations(active=True)
    observations["policies"] = list(observations["policies"])[1:]
    roles = list(observations["roles"])
    next(row for row in roles if row["rolname"] == "uok_app")["rolbypassrls"] = True

    report = verifier.evaluate_live_database_security(
        database_security_inventory(),
        observations,
        expect_active=True,
        runtime_login_role="uok_app",
        migrator_login_role=None,
        require_cross_org_probe=True,
    )

    assert report["ok"] is False
    assert report["checks"]["tenant_policy_set_is_exact"] is False
    assert report["checks"]["runtime_login_is_safe_and_bounded"] is False


def test_active_gate_rejects_no_cross_tenant_witness() -> None:
    observations = database_security_observations(active=True)
    observations["cross_org_probe"] = {
        "ok": False,
        "witness_found": False,
        "checks": {},
    }

    report = verifier.evaluate_live_database_security(
        database_security_inventory(),
        observations,
        expect_active=True,
        runtime_login_role="uok_app",
        migrator_login_role=None,
        require_cross_org_probe=True,
    )

    assert report["ok"] is False
    assert report["checks"]["cross_organization_guessed_id_probe"] is False


def test_foundation_gate_rejects_any_enabled_or_forced_rls() -> None:
    observations = database_security_observations(active=False)
    observations["tables"][0]["rls_enabled"] = True
    observations["tables"][1]["rls_forced"] = True

    report = verifier.evaluate_live_database_security(
        database_security_inventory(),
        observations,
        expect_active=False,
        runtime_login_role=None,
        migrator_login_role=None,
        require_cross_org_probe=False,
    )

    assert report["ok"] is False
    assert report["checks"]["rls_disabled_and_unforced_for_all_tables"] is False


def test_active_gate_cannot_pass_without_mandatory_probe() -> None:
    report = verifier.evaluate_live_database_security(
        database_security_inventory(),
        database_security_observations(active=True),
        expect_active=True,
        runtime_login_role="uok_app",
        migrator_login_role=None,
        require_cross_org_probe=False,
    )

    assert report["ok"] is False
    assert report["production_ready"] is False
    assert report["active_database_gate_ready"] is False
    assert report["checks"]["cross_organization_guessed_id_probe"] is False


class _Engine:
    def __init__(self, dialect: str) -> None:
        self.dialect = SimpleNamespace(name=dialect)
        self.disposed = False

    def connect(self) -> object:
        raise AssertionError("a non-PostgreSQL engine must be rejected first")

    def dispose(self) -> None:
        self.disposed = True


def test_live_inspection_rejects_non_postgresql_and_disposes_engine() -> None:
    engine = _Engine("sqlite")

    with pytest.raises(live.LiveDatabaseSecurityError, match="requires PostgreSQL"):
        live.inspect_live_database_security(
            "sqlite:///:memory:",
            engine_factory=lambda *_args, **_kwargs: engine,
        )

    assert engine.disposed is True


def test_live_inspection_requires_dedicated_admin_url() -> None:
    with pytest.raises(
        live.LiveDatabaseSecurityError,
        match="UOK_DATABASE_SECURITY_ADMIN_URL",
    ):
        live.inspect_live_database_security("")

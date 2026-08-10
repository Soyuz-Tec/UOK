from __future__ import annotations

import json
import sys
from pathlib import Path

from sqlalchemy import Column, ForeignKey, MetaData, String, Table

from uok.database_security import (
    GLOBAL_TABLE_RULES,
    database_security_inventory,
    inventory_metadata,
)


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import verify_database_security as verifier  # noqa: E402


def test_metadata_inventory_covers_every_mapped_table_without_exceptions() -> None:
    report = database_security_inventory()

    assert report["ok"] is True
    assert report["production_ready"] is False
    assert report["counts"] == {
        "tables": 64,
        "tenant_scoped": 63,
        "direct_organization_id": 61,
        "global_readonly": 1,
    }
    assert {
        row["table"]: row["isolation"]
        for row in report["tables"]
        if row["isolation"] != "direct"
    } == GLOBAL_TABLE_RULES
    assert report["unclassified_tables"] == []
    assert report["owner_gaps"] == []
    assert report["invalid_direct_tables"] == []


def test_inventory_fails_closed_for_new_unclassified_global_table() -> None:
    metadata = MetaData()
    Table("mystery_global", metadata, Column("id", String, primary_key=True))

    report = inventory_metadata(metadata, {"mystery_global": "kernel"})

    assert report["ok"] is False
    assert report["checks"]["all_tables_classified"] is False
    assert report["unclassified_tables"] == ["mystery_global"]


def test_inventory_rejects_nullable_or_unlinked_organization_column() -> None:
    metadata = MetaData()
    Table("organizations", metadata, Column("id", String, primary_key=True))
    Table(
        "unsafe_rows",
        metadata,
        Column("id", String, primary_key=True),
        Column("organization_id", String, nullable=True),
    )
    report = inventory_metadata(
        metadata,
        {"organizations": "kernel", "unsafe_rows": "unsafe.module"},
    )

    assert report["ok"] is False
    assert report["invalid_direct_tables"] == ["unsafe_rows"]

    safe_metadata = MetaData()
    Table("organizations", safe_metadata, Column("id", String, primary_key=True))
    Table(
        "safe_rows",
        safe_metadata,
        Column("id", String, primary_key=True),
        Column(
            "organization_id",
            String,
            ForeignKey("organizations.id"),
            nullable=False,
        ),
    )
    safe_report = inventory_metadata(
        safe_metadata,
        {"organizations": "kernel", "safe_rows": "safe.module"},
    )
    assert safe_report["invalid_direct_tables"] == []


def test_foundation_sql_is_complete_but_does_not_activate_rls() -> None:
    sql = (ROOT / "deploy" / "postgres" / "database-security-foundation.sql").read_text(
        encoding="utf-8"
    )
    executable_lines = [
        line.strip()
        for line in sql.splitlines()
        if line.strip() and not line.lstrip().startswith("--")
    ]
    executable = "\n".join(executable_lines)

    assert "ALTER ROLE uok_runtime" in executable
    assert "NOBYPASSRLS" in executable
    assert "WITH ADMIN FALSE, INHERIT FALSE, SET TRUE" in executable
    assert "'REVOKE %I FROM %I'" in executable
    assert "REVOKE ALL PRIVILEGES ON SCHEMA public FROM PUBLIC" in executable
    assert "REVOKE ALL PRIVILEGES ON SCHEMA public FROM uok_runtime" in executable
    assert "ON ALL TABLES IN SCHEMA public FROM uok_runtime" in executable
    assert "ON ALL SEQUENCES IN SCHEMA public FROM uok_runtime" in executable
    assert (
        "ALTER DEFAULT PRIVILEGES FOR ROLE uok_owner\nREVOKE ALL ON TABLES FROM PUBLIC"
    ) in executable
    assert (
        "ALTER DEFAULT PRIVILEGES FOR ROLE uok_owner\n"
        "REVOKE ALL ON TABLES FROM uok_runtime"
    ) in executable
    assert (
        "ALTER DEFAULT PRIVILEGES FOR ROLE uok_owner\n"
        "REVOKE ALL ON SEQUENCES FROM PUBLIC"
    ) in executable
    assert (
        "ALTER DEFAULT PRIVILEGES FOR ROLE uok_owner\n"
        "REVOKE ALL ON SEQUENCES FROM uok_runtime"
    ) in executable
    assert "REVOKE ALL ON TABLES FROM uok_runtime" in executable
    assert "REVOKE ALL ON SEQUENCES FROM uok_runtime" in executable
    assert "'DROP POLICY %I ON %I.%I'" in executable
    assert "AS PERMISSIVE FOR ALL TO uok_runtime" in executable
    assert "current_setting('uok.organization_id', true)" in executable
    assert "DISABLE ROW LEVEL SECURITY" in executable
    assert "ALTER TABLE ... ENABLE ROW LEVEL SECURITY" not in executable
    assert "ALTER TABLE ... FORCE ROW LEVEL SECURITY" not in executable


def test_offline_cli_is_deterministic_and_never_renders_credentials(
    capsys,
) -> None:
    secret_url = "postgresql+psycopg://uok:do-not-print@db/uok"
    exit_code = verifier.main(
        [],
        environment={"UOK_DATABASE_SECURITY_ADMIN_URL": secret_url},
    )
    output = capsys.readouterr().out
    report = json.loads(output)

    assert exit_code == 0
    assert report["mode"] == "offline"
    assert report["foundation_ready"] is True
    assert report["production_ready"] is False
    assert "do-not-print" not in output
    assert "UOK_DATABASE_SECURITY_ADMIN_URL" not in output


def test_active_mode_requires_live_login_and_cross_org_contract(capsys) -> None:
    assert verifier.main(["--expect-active"], environment={}) == 2
    assert (
        json.loads(capsys.readouterr().out)["error"]["message"]
        == "--expect-active requires --live"
    )

    assert (
        verifier.main(
            ["--live", "--expect-active"],
            environment={},
        )
        == 2
    )
    assert (
        "require-cross-org-probe"
        in json.loads(capsys.readouterr().out)["error"]["message"]
    )

    assert (
        verifier.main(
            [
                "--live",
                "--expect-active",
                "--require-cross-org-probe",
            ],
            environment={},
        )
        == 2
    )
    assert (
        "runtime-login-role" in json.loads(capsys.readouterr().out)["error"]["message"]
    )

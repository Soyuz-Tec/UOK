from __future__ import annotations

from pathlib import Path

import pytest
from starlette.testclient import TestClient

import uok.migration_registry as migration_registry
from tests.helpers import auth


def test_uok_migration_discipline_uses_single_active_baseline(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    discipline = client.get("/api/migrations/discipline", headers=admin)
    assert discipline.status_code == 200, discipline.text
    body = discipline.json()
    assert body["ok"] is True
    assert body["checks"]["single_active_baseline"] is True
    assert body["checks"]["baseline_has_uok_tables"] is True
    assert body["checks"]["baseline_has_declared_module_tables"] is True
    assert body["checks"]["baseline_has_contacts_tables"] is True
    assert body["checks"]["module_migration_directories_present"] is True
    assert body["checks"]["module_migration_files_scoped"] is True
    assert body["checks"]["contacts_core_module_migration_present"] is True
    assert body["checks"]["planning_core_module_migration_present"] is True
    assert {
        "parties",
        "party_relationships",
        "party_notes",
        "contact_import_batches",
        "contact_groups",
        "contact_group_members",
        "planning_projects",
        "planning_tasks",
        "planning_task_dependencies",
    }.issubset(set(body["declared_module_tables"]))
    contacts_migrations = {
        item["filename"]
        for item in body["module_migration_files"]
        if item["module"] == "contacts.core"
    }
    assert "004_contacts_core_merge_privacy.sql" in contacts_migrations
    assert any(item["module"] == "planning.core" for item in body["module_migration_files"])
    assert any(item["module"] == "product.master" for item in body["module_migration_files"])
    assert {
        "product_definitions",
        "product_name_history",
    }.issubset(set(body["declared_module_tables"]))
    assert body["checks"]["baseline_has_no_business_module_tables"] is True


def test_root_baseline_rejects_product_owner_table() -> None:
    assert migration_registry._baseline_has_no_business_module_tables(
        "CREATE TABLE organizations (id VARCHAR(36) PRIMARY KEY);"
    )
    assert not migration_registry._baseline_has_no_business_module_tables(
        "CREATE TABLE PRODUCT_DEFINITIONS (id VARCHAR(36) PRIMARY KEY);"
    )


def test_product_owner_migration_may_define_its_declared_business_table(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    migration_path = tmp_path / "modules" / "product.master" / "migrations"
    migration_path.mkdir(parents=True)
    (migration_path / "001_product_master.sql").write_text(
        "CREATE TABLE product_definitions (id VARCHAR(36) PRIMARY KEY);\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(migration_registry, "repo_root", lambda: tmp_path)
    monkeypatch.setattr(
        migration_registry,
        "load_module_manifests",
        lambda: {
            "product.master": {
                "migrations_path": "modules/product.master/migrations",
                "owned_tables": ["ProductDefinition"],
            }
        },
    )
    monkeypatch.setattr(
        migration_registry,
        "model_table_names",
        lambda: {"ProductDefinition": "product_definitions"},
    )

    assert migration_registry._module_migration_scope_violations() == []


def test_foreign_module_migration_cannot_reference_product_owner_table(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    migration_path = tmp_path / "modules" / "alpha.core" / "migrations"
    migration_path.mkdir(parents=True)
    (migration_path / "001_alpha.sql").write_text(
        "CREATE TABLE product_definitions (id VARCHAR(36) PRIMARY KEY);\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(migration_registry, "repo_root", lambda: tmp_path)
    monkeypatch.setattr(
        migration_registry,
        "load_module_manifests",
        lambda: {
            "alpha.core": {
                "migrations_path": "modules/alpha.core/migrations",
                "owned_tables": ["AlphaRecord"],
            }
        },
    )
    monkeypatch.setattr(
        migration_registry,
        "model_table_names",
        lambda: {
            "AlphaRecord": "alpha_records",
            "ProductDefinition": "product_definitions",
        },
    )

    violations = migration_registry._module_migration_scope_violations()

    assert any(
        "foreign business module table references: product_definitions"
        in violation["reason"]
        for violation in violations
    )
    assert any(
        "undeclared table references: product_definitions"
        in violation["reason"]
        for violation in violations
    )

from __future__ import annotations

from pathlib import Path

import pytest
from starlette.testclient import TestClient

import uok.migration_registry as migration_registry
from tests.helpers import auth


OWNER_TABLE_CASES = (
    (
        "compliance.core",
        "ComplianceDocumentType",
        "compliance_document_types",
    ),
    (
        "compliance.core",
        "ComplianceDocumentTypeNameHistory",
        "compliance_document_type_name_history",
    ),
    ("locations.core", "LocationDefinition", "location_definitions"),
    ("locations.core", "LocationNameHistory", "location_name_history"),
    ("product.master", "ProductDefinition", "product_definitions"),
    ("product.master", "ProductNameHistory", "product_name_history"),
    ("routes.core", "RouteDefinition", "route_definitions"),
    ("routes.core", "RouteStop", "route_stops"),
    ("routes.core", "RouteNameHistory", "route_name_history"),
    ("shipments.core", "Shipment", "shipments"),
    ("shipments.core", "ShipmentStatusHistory", "shipment_status_history"),
)


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
    assert any(item["module"] == "compliance.core" for item in body["module_migration_files"])
    assert any(item["module"] == "product.master" for item in body["module_migration_files"])
    assert any(item["module"] == "locations.core" for item in body["module_migration_files"])
    assert any(item["module"] == "routes.core" for item in body["module_migration_files"])
    assert any(item["module"] == "shipments.core" for item in body["module_migration_files"])
    assert {
        "compliance_document_types",
        "compliance_document_type_name_history",
        "location_definitions",
        "location_name_history",
        "product_definitions",
        "product_name_history",
        "route_definitions",
        "route_stops",
        "route_name_history",
        "shipments",
        "shipment_status_history",
    }.issubset(set(body["declared_module_tables"]))
    assert body["checks"]["baseline_has_no_business_module_tables"] is True


@pytest.mark.parametrize("_module_name, _model_name, table_name", OWNER_TABLE_CASES)
def test_root_baseline_rejects_feature_owner_table(
    _module_name: str,
    _model_name: str,
    table_name: str,
) -> None:
    assert migration_registry._baseline_has_no_business_module_tables(
        "CREATE TABLE organizations (id VARCHAR(36) PRIMARY KEY);"
    )
    assert not migration_registry._baseline_has_no_business_module_tables(
        f"CREATE TABLE {table_name.upper()} (id VARCHAR(36) PRIMARY KEY);"
    )


@pytest.mark.parametrize("module_name, model_name, table_name", OWNER_TABLE_CASES)
def test_owner_migration_may_define_its_declared_business_table(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    module_name: str,
    model_name: str,
    table_name: str,
) -> None:
    migration_path = tmp_path / "modules" / module_name / "migrations"
    migration_path.mkdir(parents=True)
    (migration_path / "001_owner.sql").write_text(
        f"CREATE TABLE {table_name} (id VARCHAR(36) PRIMARY KEY);\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(migration_registry, "repo_root", lambda: tmp_path)
    monkeypatch.setattr(
        migration_registry,
        "load_module_manifests",
        lambda: {
            module_name: {
                "migrations_path": f"modules/{module_name}/migrations",
                "owned_tables": [model_name],
            }
        },
    )
    monkeypatch.setattr(
        migration_registry,
        "model_table_names",
        lambda: {model_name: table_name},
    )

    assert migration_registry._module_migration_scope_violations() == []


@pytest.mark.parametrize("_module_name, model_name, table_name", OWNER_TABLE_CASES)
def test_foreign_module_migration_cannot_reference_owner_table(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    _module_name: str,
    model_name: str,
    table_name: str,
) -> None:
    migration_path = tmp_path / "modules" / "alpha.core" / "migrations"
    migration_path.mkdir(parents=True)
    (migration_path / "001_alpha.sql").write_text(
        f"CREATE TABLE {table_name} (id VARCHAR(36) PRIMARY KEY);\n",
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
            model_name: table_name,
        },
    )

    violations = migration_registry._module_migration_scope_violations()

    assert any(
        f"foreign business module table references: {table_name}" in violation["reason"]
        for violation in violations
    )
    assert any(
        f"undeclared table references: {table_name}" in violation["reason"]
        for violation in violations
    )


def test_route_migration_cannot_foreign_key_location_table(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    migration_path = tmp_path / "modules" / "routes.core" / "migrations"
    migration_path.mkdir(parents=True)
    (migration_path / "001_routes.sql").write_text(
        "CREATE TABLE route_stops ("
        "id VARCHAR(36) PRIMARY KEY, "
        "location_definition_id VARCHAR(36) REFERENCES location_definitions(id)"
        ");\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(migration_registry, "repo_root", lambda: tmp_path)
    monkeypatch.setattr(
        migration_registry,
        "load_module_manifests",
        lambda: {
            "routes.core": {
                "migrations_path": "modules/routes.core/migrations",
                "owned_tables": ["RouteStop"],
            }
        },
    )
    monkeypatch.setattr(
        migration_registry,
        "model_table_names",
        lambda: {
            "LocationDefinition": "location_definitions",
            "RouteStop": "route_stops",
        },
    )

    violations = migration_registry._module_migration_scope_violations()

    assert any(
        "foreign business module table references: location_definitions" in violation["reason"]
        for violation in violations
    )

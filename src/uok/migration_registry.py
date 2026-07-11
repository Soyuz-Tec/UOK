from __future__ import annotations

import re
from hashlib import sha256
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import TARGET_VERSION
from .kernel_models import SchemaVersion
from .module_model_registry import ensure_module_models_registered
from .module_manifest_loader import load_module_manifests
from .module_paths import repo_root
from .module_tables import declared_module_table_names, model_table_names

MIGRATION_FILE = "001_initial_baseline.sql"
FORBIDDEN_BUSINESS_TABLES = ("product_definitions", "cargo_transactions", "agreements")
CREATE_TABLE_PATTERN = re.compile(r"\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][A-Za-z0-9_]*)", re.IGNORECASE)
INDEX_ON_PATTERN = re.compile(r"\bON\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(", re.IGNORECASE)


def migration_root() -> Path:
    return Path(__file__).resolve().parents[2] / "migrations"


def module_migration_files() -> list[dict[str, Any]]:
    root = repo_root()
    files: list[dict[str, Any]] = []
    for module_name, manifest in load_module_manifests().items():
        migrations_path = root / str(manifest["migrations_path"])
        sql_files = sorted(migrations_path.glob("*.sql")) if migrations_path.exists() else []
        for path in sql_files:
            text = path.read_text(encoding="utf-8")
            files.append({
                "module": module_name,
                "path": path.relative_to(root).as_posix(),
                "filename": path.name,
                "sha256": sha256(text.encode()).hexdigest(),
            })
    return files


def verify_migration_discipline(db: Session | None = None) -> dict[str, Any]:
    ensure_module_models_registered()
    root = migration_root()
    path = root / MIGRATION_FILE
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    sql_files = sorted(item.name for item in root.glob("*.sql")) if root.exists() else []
    manifests = load_module_manifests()
    declared_tables = sorted(declared_module_table_names())
    module_files = module_migration_files()
    module_text = _module_migration_text()
    module_scope_violations = _module_migration_scope_violations()
    applied_versions: list[str] = []
    if db is not None:
        applied_versions = list(db.scalars(select(SchemaVersion.version)).all())
    checks = {
        "migration_directory_present": root.exists(),
        "single_active_baseline": sql_files == [MIGRATION_FILE],
        "baseline_file_present": path.exists(),
        "baseline_declares_target_version": TARGET_VERSION in text,
        "baseline_has_uok_tables": all(name in text for name in ("organizations", "users", "modules", "command_logs", "events")),
        "baseline_has_declared_module_tables": all(name in f"{text}\n{module_text}" for name in declared_tables),
        "baseline_has_contacts_tables": all(name in text for name in ("parties", "party_relationships", "party_notes", "contact_import_batches")),
        "baseline_has_no_business_module_tables": all(name not in text for name in FORBIDDEN_BUSINESS_TABLES),
        "module_migration_directories_present": all((repo_root() / str(manifest["migrations_path"])).is_dir() for manifest in manifests.values()),
        "module_migration_files_scoped": not module_scope_violations,
        "contacts_core_module_migration_present": any(item["module"] == "contacts.core" for item in module_files),
        "planning_core_module_migration_present": any(item["module"] == "planning.core" for item in module_files),
        "target_schema_version_applied": not db or TARGET_VERSION in applied_versions,
    }
    return {
        "ok": all(checks.values()),
        "target_version": TARGET_VERSION,
        "checks": checks,
        "files": [{
            "filename": MIGRATION_FILE,
            "sha256": sha256(text.encode()).hexdigest() if text else None,
        }],
        "module_migration_files": module_files,
        "module_migration_scope_violations": module_scope_violations,
        "declared_module_tables": declared_tables,
        "applied_schema_versions": applied_versions,
    }


def _declared_tables_for_module(manifest: dict[str, Any]) -> set[str]:
    tables_by_model = model_table_names()
    tables: set[str] = set()
    for owner in manifest.get("owned_tables", []):
        model_name = str(owner).split(":", 1)[0]
        table_name = tables_by_model.get(model_name)
        if table_name:
            tables.add(table_name)
    return tables


def _module_migration_text() -> str:
    root = repo_root()
    chunks: list[str] = []
    for manifest in load_module_manifests().values():
        migrations_path = root / str(manifest["migrations_path"])
        sql_files = sorted(migrations_path.glob("*.sql")) if migrations_path.exists() else []
        chunks.extend(path.read_text(encoding="utf-8") for path in sql_files)
    return "\n".join(chunks)


def _module_migration_scope_violations() -> list[dict[str, str]]:
    root = repo_root()
    violations: list[dict[str, str]] = []
    for module_name, manifest in load_module_manifests().items():
        migrations_path = root / str(manifest["migrations_path"])
        declared_tables = _declared_tables_for_module(manifest)
        sql_files = sorted(migrations_path.glob("*.sql")) if migrations_path.exists() else []
        for path in sql_files:
            text = path.read_text(encoding="utf-8")
            lowered = text.lower()
            if any(name in lowered for name in FORBIDDEN_BUSINESS_TABLES):
                violations.append({"module": module_name, "path": path.relative_to(root).as_posix(), "reason": "business module table reference"})
            referenced_tables = set(CREATE_TABLE_PATTERN.findall(text)) | set(INDEX_ON_PATTERN.findall(text))
            undeclared = sorted(table for table in referenced_tables if table not in declared_tables)
            if undeclared:
                violations.append({
                    "module": module_name,
                    "path": path.relative_to(root).as_posix(),
                    "reason": f"undeclared table references: {', '.join(undeclared)}",
                })
    return violations

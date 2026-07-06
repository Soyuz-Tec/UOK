from __future__ import annotations

from hashlib import sha256
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import TARGET_VERSION
from .models import SchemaVersion
from .module_tables import declared_module_table_names

MIGRATION_FILE = "001_initial_baseline.sql"


def migration_root() -> Path:
    return Path(__file__).resolve().parents[2] / "migrations"


def verify_migration_discipline(db: Session | None = None) -> dict[str, Any]:
    root = migration_root()
    path = root / MIGRATION_FILE
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    sql_files = sorted(item.name for item in root.glob("*.sql")) if root.exists() else []
    forbidden_business_tables = ("product_" + "definitions", "cargo_" + "transactions", "agreements")
    declared_tables = sorted(declared_module_table_names())
    applied_versions: list[str] = []
    if db is not None:
        applied_versions = list(db.scalars(select(SchemaVersion.version)).all())
    checks = {
        "migration_directory_present": root.exists(),
        "single_active_baseline": sql_files == [MIGRATION_FILE],
        "baseline_file_present": path.exists(),
        "baseline_declares_target_version": TARGET_VERSION in text,
        "baseline_has_uok_tables": all(name in text for name in ("organizations", "users", "modules", "command_logs", "events")),
        "baseline_has_declared_module_tables": all(name in text for name in declared_tables),
        "baseline_has_contacts_tables": all(name in text for name in ("parties", "party_relationships", "party_notes", "contact_import_batches")),
        "baseline_has_no_business_module_tables": all(name not in text for name in forbidden_business_tables),
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
        "declared_module_tables": declared_tables,
        "applied_schema_versions": applied_versions,
    }

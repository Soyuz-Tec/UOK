from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import CommandLog, EventRecord
from .module_dependencies import ensure_dependencies_operational, module_dependents, module_record
from .modules import module_catalog
from .util import loads


def module_status(db: Session, organization_id: str, module_name: str) -> dict[str, Any]:
    manifest = module_catalog().get(module_name)
    row = module_record(db, organization_id, module_name)
    if not manifest:
        raise ValueError("module_name is not declared")
    return {
        "name": module_name,
        "declared": True,
        "status": row.status if row else "available",
        "version": row.version if row else manifest["version"],
        "kind": manifest["kind"],
        "installable": manifest["installable"],
        "uninstallable": manifest["uninstallable"],
        "updatable": manifest["updatable"],
        "maintainable": manifest["maintainable"],
        "required": manifest.get("required", False),
        "dependencies": manifest.get("dependencies", []),
        "dependents": module_dependents(module_name),
    }


def module_maintenance_report(db: Session, organization_id: str, module_name: str) -> dict[str, Any]:
    manifest = module_catalog().get(module_name)
    if not manifest:
        raise ValueError("module_name is not declared")
    command_count = db.scalar(select(func.count(CommandLog.id)).where(
        CommandLog.organization_id == organization_id,
        CommandLog.command_type.in_(manifest.get("commands", []) or ["__none__"]),
    )) or 0
    event_count = db.scalar(select(func.count(EventRecord.id)).where(
        EventRecord.organization_id == organization_id,
        EventRecord.event_type.in_(manifest.get("events", []) or ["__none__"]),
    )) or 0
    row = module_record(db, organization_id, module_name)
    manifest_json_ok = True
    if row:
        try:
            loads(row.manifest_json)
        except ValueError:
            manifest_json_ok = False
    checks = {
        "declared": True,
        "manifest_json_valid": manifest_json_ok,
        "dependencies_operational": True,
        "uok_compromise_required": False,
    }
    try:
        ensure_dependencies_operational(db, organization_id, module_name)
    except ValueError:
        checks["dependencies_operational"] = False
    return {
        "ok": all(checks.values()),
        "module": module_status(db, organization_id, module_name),
        "checks": checks,
        "metrics": {"commands": command_count, "events": event_count},
        "operations_safe_for_uok": checks["uok_compromise_required"] is False,
    }

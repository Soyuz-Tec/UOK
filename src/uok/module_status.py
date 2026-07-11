from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import CommandLog, EventRecord
from .module_dependencies import ensure_dependencies_operational, module_dependents, module_record
from .module_lifecycle_policy import (
    default_module_status,
    ensure_action_supported,
    manifest_lifecycle,
    manifest_maturity,
)
from .modules import module_catalog
from .util import dumps, loads


def module_status(db: Session, organization_id: str, module_name: str) -> dict[str, Any]:
    manifest = module_catalog().get(module_name)
    row = module_record(db, organization_id, module_name)
    if not manifest:
        raise ValueError("module_name is not declared")
    recorded_status = row.status if row else None
    status = (
        "planned"
        if manifest_maturity(manifest) == "planned"
        else recorded_status or default_module_status(manifest)
    )
    lifecycle = manifest_lifecycle(manifest)
    managed_snapshot = manifest_maturity(manifest) == "planned" or manifest.get("required") is True
    persisted_drift = bool(
        row
        and managed_snapshot
        and (
            row.kind != manifest["kind"]
            or row.version != manifest["version"]
            or row.manifest_json != dumps(manifest)
        )
    )
    return {
        "name": module_name,
        "declared": True,
        "status": status,
        "recorded_status": recorded_status,
        "reconciliation_required": (
            (recorded_status is not None and recorded_status != status)
            or (manifest.get("required") is True and recorded_status is None)
            or status not in lifecycle
            or persisted_drift
        ),
        "maturity": manifest_maturity(manifest),
        "version": row.version if row else manifest["version"],
        "kind": manifest["kind"],
        "installable": manifest["installable"],
        "uninstallable": manifest["uninstallable"],
        "updatable": manifest["updatable"],
        "maintainable": manifest["maintainable"],
        "required": manifest.get("required", False),
        "lifecycle": lifecycle,
        "lifecycle_state_declared": status in lifecycle,
        "dependencies": manifest.get("dependencies", []),
        "dependents": module_dependents(module_name),
    }


def module_maintenance_report(db: Session, organization_id: str, module_name: str) -> dict[str, Any]:
    manifest = module_catalog().get(module_name)
    if not manifest:
        raise ValueError("module_name is not declared")
    ensure_action_supported(manifest, "maintenance")
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
        "maintainable": True,
        "manifest_json_valid": manifest_json_ok,
        "dependencies_operational": True,
        "lifecycle_state_declared": module_status(db, organization_id, module_name)["lifecycle_state_declared"],
        "uok_compromise_required": False,
    }
    try:
        ensure_dependencies_operational(db, organization_id, module_name)
    except ValueError:
        checks["dependencies_operational"] = False
    positive_checks = [value for key, value in checks.items() if key != "uok_compromise_required"]
    return {
        "ok": all(positive_checks) and checks["uok_compromise_required"] is False,
        "module": module_status(db, organization_id, module_name),
        "checks": checks,
        "metrics": {"commands": command_count, "events": event_count},
        "operations_safe_for_uok": checks["uok_compromise_required"] is False,
    }

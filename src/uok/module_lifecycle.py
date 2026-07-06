from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from . import APP_VERSION
from .models import ModuleRecord
from .module_dependencies import emit_module_event, ensure_dependencies_operational, installed_dependents, module_record
from .module_status import module_status
from .modules import module_catalog
from .util import dumps


def install_module(db: Session, organization_id: str, module_name: str) -> dict[str, Any]:
    manifest = module_catalog().get(module_name)
    if not manifest:
        raise ValueError("module_name is not declared")
    ensure_dependencies_operational(db, organization_id, module_name)
    row = module_record(db, organization_id, module_name)
    if not row:
        row = ModuleRecord(
            organization_id=organization_id,
            name=module_name,
            kind=manifest["kind"],
            version=manifest["version"],
            status="installed",
            manifest_json=dumps(manifest),
        )
        db.add(row)
        db.flush()
    else:
        row.status = "installed"
        row.version = manifest["version"]
        row.manifest_json = dumps(manifest)
    emit_module_event(db, organization_id, "ModuleInstalled", module_name, {"version": manifest["version"]})
    db.commit()
    return module_status(db, organization_id, module_name)


def uninstall_module(db: Session, organization_id: str, module_name: str) -> dict[str, Any]:
    row = module_record(db, organization_id, module_name)
    if not row:
        raise ValueError("module is not installed")
    manifest = module_catalog().get(module_name)
    if not manifest or manifest.get("uninstallable") is not True:
        raise ValueError("module is required and cannot be uninstalled")
    dependents = installed_dependents(db, organization_id, module_name)
    if dependents:
        raise ValueError(f"module has installed dependents: {', '.join(dependents)}")
    row.status = "uninstalled"
    emit_module_event(db, organization_id, "ModuleUninstalled", module_name, {"version": row.version})
    db.commit()
    return module_status(db, organization_id, module_name)


def disable_module(db: Session, organization_id: str, module_name: str) -> dict[str, Any]:
    row = module_record(db, organization_id, module_name)
    if not row or row.status not in {"installed", "upgraded"}:
        raise ValueError("module is not operational")
    manifest = module_catalog().get(module_name)
    if not manifest or manifest.get("required") is True:
        raise ValueError("module is required and cannot be disabled")
    dependents = installed_dependents(db, organization_id, module_name)
    if dependents:
        raise ValueError(f"module has installed dependents: {', '.join(dependents)}")
    row.status = "disabled"
    emit_module_event(db, organization_id, "ModuleDisabled", module_name, {"version": row.version})
    db.commit()
    return module_status(db, organization_id, module_name)


def enable_module(db: Session, organization_id: str, module_name: str) -> dict[str, Any]:
    row = module_record(db, organization_id, module_name)
    if not row or row.status != "disabled":
        raise ValueError("module is not disabled")
    ensure_dependencies_operational(db, organization_id, module_name)
    row.status = "installed"
    emit_module_event(db, organization_id, "ModuleEnabled", module_name, {"version": row.version})
    db.commit()
    return module_status(db, organization_id, module_name)


def upgrade_module(db: Session, organization_id: str, module_name: str) -> dict[str, Any]:
    row = module_record(db, organization_id, module_name)
    manifest = module_catalog().get(module_name)
    if not row or not manifest:
        raise ValueError("module is not installed")
    ensure_dependencies_operational(db, organization_id, module_name)
    row.status = "upgraded"
    row.version = APP_VERSION
    row.manifest_json = dumps(manifest)
    emit_module_event(db, organization_id, "ModuleUpgraded", module_name, {"version": APP_VERSION})
    db.commit()
    return module_status(db, organization_id, module_name)

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .kernel_models import ModuleRecord, Organization
from .module_dependencies import emit_module_event, ensure_dependencies_operational, installed_dependents, module_record
from .module_lifecycle_policy import (
    default_module_status,
    ensure_action_supported,
    ensure_status_transition,
    manifest_lifecycle,
    manifest_maturity,
)
from .module_status import module_status
from .modules import module_catalog
from .util import dumps


def _module_lifecycle_scope_statement(organization_id: str):
    return (
        select(Organization.id)
        .where(Organization.id == organization_id)
        .with_for_update()
    )


def _lock_module_lifecycle_scope(
    db: Session,
    organization_id: str,
    module_name: str,
) -> ModuleRecord | None:
    db.scalar(_module_lifecycle_scope_statement(organization_id))
    return module_record(db, organization_id, module_name, lock=True)


def install_module(db: Session, organization_id: str, module_name: str) -> dict[str, Any]:
    manifest = module_catalog().get(module_name)
    if not manifest:
        raise ValueError("module_name is not declared")
    ensure_action_supported(manifest, "install")
    row = _lock_module_lifecycle_scope(db, organization_id, module_name)
    ensure_dependencies_operational(db, organization_id, module_name)
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
        ensure_status_transition(manifest, "install", row.status)
        row.status = "installed"
        row.version = manifest["version"]
        row.manifest_json = dumps(manifest)
    emit_module_event(db, organization_id, "ModuleInstalled", module_name, {"version": manifest["version"]})
    db.commit()
    return module_status(db, organization_id, module_name)


def uninstall_module(db: Session, organization_id: str, module_name: str) -> dict[str, Any]:
    manifest = module_catalog().get(module_name)
    if not manifest:
        raise ValueError("module_name is not declared")
    ensure_action_supported(manifest, "uninstall")
    row = _lock_module_lifecycle_scope(db, organization_id, module_name)
    if not row:
        raise ValueError("module is not installed")
    ensure_status_transition(manifest, "uninstall", row.status)
    dependents = installed_dependents(db, organization_id, module_name)
    if dependents:
        raise ValueError(f"module has installed dependents: {', '.join(dependents)}")
    row.status = "uninstalled"
    emit_module_event(db, organization_id, "ModuleUninstalled", module_name, {"version": row.version})
    db.commit()
    return module_status(db, organization_id, module_name)


def disable_module(db: Session, organization_id: str, module_name: str) -> dict[str, Any]:
    manifest = module_catalog().get(module_name)
    if not manifest:
        raise ValueError("module_name is not declared")
    ensure_action_supported(manifest, "disable")
    row = _lock_module_lifecycle_scope(db, organization_id, module_name)
    if not row:
        raise ValueError("module is not operational")
    ensure_status_transition(manifest, "disable", row.status)
    dependents = installed_dependents(db, organization_id, module_name)
    if dependents:
        raise ValueError(f"module has installed dependents: {', '.join(dependents)}")
    row.status = "disabled"
    emit_module_event(db, organization_id, "ModuleDisabled", module_name, {"version": row.version})
    db.commit()
    return module_status(db, organization_id, module_name)


def enable_module(db: Session, organization_id: str, module_name: str) -> dict[str, Any]:
    manifest = module_catalog().get(module_name)
    if not manifest:
        raise ValueError("module_name is not declared")
    ensure_action_supported(manifest, "enable")
    row = _lock_module_lifecycle_scope(db, organization_id, module_name)
    if not row:
        raise ValueError("module is not disabled")
    ensure_status_transition(manifest, "enable", row.status)
    ensure_dependencies_operational(db, organization_id, module_name)
    row.status = "installed"
    emit_module_event(db, organization_id, "ModuleEnabled", module_name, {"version": row.version})
    db.commit()
    return module_status(db, organization_id, module_name)


def upgrade_module(db: Session, organization_id: str, module_name: str) -> dict[str, Any]:
    manifest = module_catalog().get(module_name)
    if not manifest:
        raise ValueError("module_name is not declared")
    ensure_action_supported(manifest, "upgrade")
    row = _lock_module_lifecycle_scope(db, organization_id, module_name)
    if not row:
        raise ValueError("module is not installed")
    ensure_status_transition(manifest, "upgrade", row.status)
    ensure_dependencies_operational(db, organization_id, module_name)
    row.status = "upgraded"
    row.version = manifest["version"]
    row.manifest_json = dumps(manifest)
    emit_module_event(db, organization_id, "ModuleUpgraded", module_name, {"version": manifest["version"]})
    db.commit()
    return module_status(db, organization_id, module_name)


def reconcile_module_record(
    db: Session,
    organization_id: str,
    module_name: str,
) -> dict[str, Any]:
    manifest = module_catalog().get(module_name)
    if not manifest:
        raise ValueError("module_name is not declared")

    row = _lock_module_lifecycle_scope(db, organization_id, module_name)
    recorded_status = row.status if row else None
    recorded_version = row.version if row else None
    created = False
    if not row:
        if manifest.get("required") is not True:
            db.commit()
            return {"reconciled": False, "module": module_status(db, organization_id, module_name)}
        row = ModuleRecord(
            organization_id=organization_id,
            name=module_name,
            kind=manifest["kind"],
            version=manifest["version"],
            status=default_module_status(manifest),
            manifest_json=dumps(manifest),
        )
        db.add(row)
        db.flush()
        created = True

    current_manifest = dumps(manifest)
    lifecycle = manifest_lifecycle(manifest)
    managed_record = (
        manifest_maturity(manifest) == "planned"
        or manifest.get("required") is True
        or row.status not in lifecycle
    )
    desired_status = (
        "planned"
        if manifest_maturity(manifest) == "planned"
        else row.status if row.status in lifecycle else default_module_status(manifest)
    )
    requires_reconciliation = (
        created
        or row.status != desired_status
        or row.kind != manifest["kind"]
        or row.version != manifest["version"]
        or row.manifest_json != current_manifest
    ) and managed_record
    if not requires_reconciliation:
        db.commit()
        return {"reconciled": False, "module": module_status(db, organization_id, module_name)}

    row.status = desired_status
    row.kind = manifest["kind"]
    row.version = manifest["version"]
    row.manifest_json = current_manifest
    emit_module_event(
        db,
        organization_id,
        "ModuleLifecycleReconciled",
        module_name,
        {
            "created": created,
            "maturity": manifest_maturity(manifest),
            "recorded_status": recorded_status,
            "recorded_version": recorded_version,
            "status": desired_status,
            "version": manifest["version"],
        },
    )
    db.commit()
    return {"reconciled": True, "module": module_status(db, organization_id, module_name)}


def reconcile_planned_module_record(
    db: Session,
    organization_id: str,
    module_name: str,
) -> dict[str, Any]:
    manifest = module_catalog().get(module_name)
    if not manifest:
        raise ValueError("module_name is not declared")
    if manifest_maturity(manifest) != "planned":
        raise ValueError("module is not planned")
    return reconcile_module_record(db, organization_id, module_name)

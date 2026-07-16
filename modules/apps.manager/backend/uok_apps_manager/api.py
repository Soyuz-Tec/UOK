from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from uok.host.database import get_db
from uok.host.security import current_actor
from uok.kernel.module_runtime import (
    disable_module,
    enable_module,
    install_module,
    module_catalog,
    module_contracts,
    module_lifecycle_report,
    module_maintenance_report,
    module_status,
    reconcile_module_record,
    uninstall_module,
    upgrade_module,
)
from uok.kernel.security import Actor, require_permission


router = APIRouter(prefix="/api/modules", tags=["modules"])
LifecycleOperation = Callable[[Session, str, str], dict[str, Any]]


def _run_lifecycle_operation(
    operation: LifecycleOperation,
    db: Session,
    actor: Actor,
    module_name: str,
) -> dict[str, Any]:
    try:
        return operation(db, actor.organization_id, module_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/contracts")
def contracts(actor: Actor = Depends(current_actor)) -> dict[str, Any]:
    require_permission(actor, "module.read")
    return module_contracts()


@router.get("/catalog")
def catalog(
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    require_permission(actor, "module.read")
    return {
        "modules": {
            name: module_status(db, actor.organization_id, name)
            for name in module_catalog()
        }
    }


@router.get("/lifecycle")
def module_lifecycle(actor: Actor = Depends(current_actor)) -> dict[str, Any]:
    require_permission(actor, "module.read")
    return module_lifecycle_report()


@router.get("/{module_name}/status")
def get_module_status(
    module_name: str,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    require_permission(actor, "module.read")
    try:
        return module_status(db, actor.organization_id, module_name)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{module_name}/maintenance")
def get_module_maintenance(
    module_name: str,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    require_permission(actor, "module.read")
    try:
        return module_maintenance_report(db, actor.organization_id, module_name)
    except ValueError as exc:
        raise HTTPException(status_code=404 if "not declared" in str(exc) else 400, detail=str(exc)) from exc


@router.post("/{module_name}/install")
def install_module_endpoint(
    module_name: str,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    require_permission(actor, "module.manage")
    return _run_lifecycle_operation(install_module, db, actor, module_name)


@router.post("/{module_name}/uninstall")
def uninstall_module_endpoint(
    module_name: str,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    require_permission(actor, "module.manage")
    return _run_lifecycle_operation(uninstall_module, db, actor, module_name)


@router.post("/{module_name}/disable")
def disable_module_endpoint(
    module_name: str,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    require_permission(actor, "module.manage")
    return _run_lifecycle_operation(disable_module, db, actor, module_name)


@router.post("/{module_name}/enable")
def enable_module_endpoint(
    module_name: str,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    require_permission(actor, "module.manage")
    return _run_lifecycle_operation(enable_module, db, actor, module_name)


@router.post("/{module_name}/upgrade")
def upgrade_module_endpoint(
    module_name: str,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    require_permission(actor, "module.manage")
    return _run_lifecycle_operation(upgrade_module, db, actor, module_name)


@router.post("/{module_name}/reconcile")
def reconcile_module_endpoint(
    module_name: str,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    require_permission(actor, "module.manage")
    return _run_lifecycle_operation(reconcile_module_record, db, actor, module_name)

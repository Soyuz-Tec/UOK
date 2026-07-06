from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..module_ops import disable_module, enable_module, install_module, module_maintenance_report, module_status, uninstall_module, upgrade_module
from ..modules import module_catalog, module_contracts, module_lifecycle_report
from ..security import Actor, current_actor, require_permission

router = APIRouter(prefix="/api/modules", tags=["modules"])


@router.get("/contracts")
def contracts(actor: Actor = Depends(current_actor)) -> dict[str, Any]:
    require_permission(actor, "module.read")
    return module_contracts()


@router.get("/catalog")
def catalog(actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_permission(actor, "module.read")
    return {"modules": {name: module_status(db, actor.organization_id, name) for name in module_catalog()}}


@router.get("/lifecycle")
def module_lifecycle(actor: Actor = Depends(current_actor)) -> dict[str, Any]:
    require_permission(actor, "module.read")
    return module_lifecycle_report()


@router.get("/{module_name}/status")
def get_module_status(module_name: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_permission(actor, "module.read")
    try:
        return module_status(db, actor.organization_id, module_name)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{module_name}/maintenance")
def get_module_maintenance(module_name: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_permission(actor, "module.read")
    try:
        return module_maintenance_report(db, actor.organization_id, module_name)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{module_name}/install")
def install_module_endpoint(module_name: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_permission(actor, "module.manage")
    try:
        return install_module(db, actor.organization_id, module_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{module_name}/uninstall")
def uninstall_module_endpoint(module_name: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_permission(actor, "module.manage")
    try:
        return uninstall_module(db, actor.organization_id, module_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{module_name}/disable")
def disable_module_endpoint(module_name: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_permission(actor, "module.manage")
    try:
        return disable_module(db, actor.organization_id, module_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{module_name}/enable")
def enable_module_endpoint(module_name: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_permission(actor, "module.manage")
    try:
        return enable_module(db, actor.organization_id, module_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{module_name}/upgrade")
def upgrade_module_endpoint(module_name: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_permission(actor, "module.manage")
    try:
        return upgrade_module(db, actor.organization_id, module_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import APP_VERSION, TARGET_VERSION
from ..host.database import database_pool_snapshot, get_db
from ..host.module_reports import module_dashboard_counts
from ..host.security import current_actor
from ..kernel.security import Actor, require_permission
from ..kernel_models import CommandLog, EventRecord, ModuleRecord
from ..evidence import baseline_evidence
from ..migration_registry import verify_migration_discipline
from ..quality import baseline_report, source_boundary_report

router = APIRouter(tags=["system"])


@router.get("/health")
def health(db: Session = Depends(get_db)) -> dict[str, Any]:
    return {
        "status": "ok",
        "name": "UOK",
        "version": APP_VERSION,
        "target_version": TARGET_VERSION,
        "events": db.scalar(select(func.count(EventRecord.id))) or 0,
        "failed_commands": db.scalar(select(func.count(CommandLog.id)).where(CommandLog.status.in_(("denied", "validation_error")))) or 0,
    }


@router.get("/api/dashboard")
def dashboard(actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    counts = {
        "modules": db.scalar(select(func.count(ModuleRecord.id)).where(ModuleRecord.organization_id == actor.organization_id)) or 0,
        "events": db.scalar(select(func.count(EventRecord.id)).where(EventRecord.organization_id == actor.organization_id)) or 0,
    }
    counts.update(module_dashboard_counts(db, actor))
    return {
        "counts": counts
    }


@router.get("/api/migrations/discipline")
def migration_discipline(actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_permission(actor, "migration.verify")
    return verify_migration_discipline(db)


@router.get("/api/baseline-evidence")
def evidence(actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_permission(actor, "evidence.read")
    return baseline_evidence(db, actor.organization_id)


@router.get("/api/architecture/source-boundary")
def source_boundary(actor: Actor = Depends(current_actor)) -> dict[str, Any]:
    require_permission(actor, "architecture.read")
    return source_boundary_report()


@router.get("/api/architecture/database-pool")
def database_pool(actor: Actor = Depends(current_actor)) -> dict[str, Any]:
    require_permission(actor, "architecture.read")
    return database_pool_snapshot()


@router.get("/api/architecture/alignment")
def architecture_alignment(actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_permission(actor, "architecture.read")
    return baseline_report(db, actor.organization_id)


@router.post("/api/architecture/verify-baseline")
def verify_baseline(actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_permission(actor, "migration.verify")
    return {"status": "succeeded", "result": baseline_report(db, actor.organization_id)}

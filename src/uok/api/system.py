from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..host.database import database_pool_snapshot, get_db
from ..host.module_reports import module_dashboard_counts
from ..host.security import current_actor
from ..kernel.security import Actor, require_permission
from ..kernel_models import CommandLog, EventRecord, ModuleRecord
from ..evidence import baseline_evidence
from ..migration_registry import verify_migration_discipline
from ..module_contract_validation import validate_module_runtime_contracts
from ..operations import liveness_report, readiness_report
from ..quality import baseline_report, source_boundary_report

router = APIRouter(tags=["system"])


def _apply_readiness_status(response: Response, report: dict[str, Any]) -> None:
    if report["status"] != "ok":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE


@router.get("/health/live")
def health_live() -> dict[str, Any]:
    return liveness_report()


@router.get(
    "/health/ready",
    responses={503: {"description": "Database or schema is not ready"}},
)
def health_ready(
    response: Response,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    report = readiness_report(db)
    _apply_readiness_status(response, report)
    return report


@router.get(
    "/health",
    responses={503: {"description": "Database or schema is not ready"}},
)
def health(
    response: Response,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    report = readiness_report(db)
    report["candidate_state"] = os.getenv("UOK_CANDIDATE_STATE", "persistent")
    _apply_readiness_status(response, report)
    return report


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


@router.get("/api/operations/diagnostics")
def operations_diagnostics(
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    require_permission(actor, "architecture.read")
    migrations = verify_migration_discipline(db)
    modules = validate_module_runtime_contracts()
    counts = {
        "events": db.scalar(
            select(func.count(EventRecord.id)).where(
                EventRecord.organization_id == actor.organization_id
            )
        )
        or 0,
        "failed_commands": db.scalar(
            select(func.count(CommandLog.id)).where(
                CommandLog.organization_id == actor.organization_id,
                CommandLog.status.in_(("denied", "validation_error")),
            )
        )
        or 0,
    }
    checks = {
        "migrations": bool(migrations["ok"]),
        "module_contracts": bool(modules["ok"]),
    }
    return {
        "status": "ok" if all(checks.values()) else "degraded",
        "checks": checks,
        "counts": counts,
        "database_pool": database_pool_snapshot(),
        "migrations": migrations,
        "module_contracts": modules,
    }


@router.get("/api/architecture/alignment")
def architecture_alignment(actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_permission(actor, "architecture.read")
    return baseline_report(db, actor.organization_id)


@router.post("/api/architecture/verify-baseline")
def verify_baseline(actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_permission(actor, "migration.verify")
    return {"status": "succeeded", "result": baseline_report(db, actor.organization_id)}

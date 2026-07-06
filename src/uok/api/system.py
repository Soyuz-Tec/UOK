from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import APP_VERSION, TARGET_VERSION
from ..db import get_db
from ..evidence import baseline_evidence
from ..migration_registry import verify_migration_discipline
from ..models import CommandLog, EventRecord, ModuleRecord, Party
from ..quality import baseline_report, source_boundary_report
from ..security import Actor, current_actor, require_permission

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
    return {
        "counts": {
            "contacts": db.scalar(select(func.count(Party.id)).where(Party.organization_id == actor.organization_id, Party.party_type == "person", Party.status != "purged")) or 0,
            "organizations": db.scalar(select(func.count(Party.id)).where(Party.organization_id == actor.organization_id, Party.party_type == "organization", Party.status != "purged")) or 0,
            "review_queue": db.scalar(select(func.count(Party.id)).where(Party.organization_id == actor.organization_id, Party.review_state.in_(("needs_review", "possible_duplicate", "incomplete")), Party.status != "purged")) or 0,
            "modules": db.scalar(select(func.count(ModuleRecord.id)).where(ModuleRecord.organization_id == actor.organization_id)) or 0,
            "events": db.scalar(select(func.count(EventRecord.id)).where(EventRecord.organization_id == actor.organization_id)) or 0,
        }
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


@router.get("/api/architecture/alignment")
def architecture_alignment(actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_permission(actor, "architecture.read")
    return baseline_report(db, actor.organization_id)


@router.post("/api/architecture/verify-baseline")
def verify_baseline(actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_permission(actor, "migration.verify")
    return {"status": "succeeded", "result": baseline_report(db, actor.organization_id)}

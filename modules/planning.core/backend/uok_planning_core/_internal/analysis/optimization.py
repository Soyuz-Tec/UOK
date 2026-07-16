from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok_planning_core._internal.persistence.models import PlanningAnalysisRecommendation, PlanningAnalysisRun, PlanningTask
from uok_planning_core._internal.analysis.optimizer_engine import OPTIMIZER_ENGINE_NAME, OPTIMIZER_ENGINE_VERSION, run_optimizer
from uok_planning_core._internal.analysis.risk_analysis import analysis_checksum, analysis_integrity
from uok_planning_core._internal.analysis.risk_engine import require_current_snapshot_cpm
from uok_planning_core._internal.scheduling.scheduler import apply_schedule, parse_planning_date, project_calendar, project_or_error, task_or_error
from uok_planning_core._internal.scheduling.schedule_math import working_duration
from uok_planning_core._internal.analysis.what_if import what_if_integrity, what_if_or_error
from uok.security import Actor
from uok.util import dumps, loads


def create_optimization(db: Session, actor: Actor, project_id: str, payload: dict[str, Any], command_id: str) -> PlanningAnalysisRun:
    snapshot = what_if_or_error(db, actor, project_id, str(payload.get("snapshot_id") or ""))
    if not what_if_integrity(snapshot)["verified"]:
        raise ValueError("optimization requires a verified what-if snapshot")
    inputs, limits, result = run_optimizer(loads(snapshot.snapshot_json, {}), payload)
    inputs = {"snapshot_id": snapshot.id, "snapshot_checksum": snapshot.checksum, **inputs}
    if not result["independent_validation"]["ok"]:
        raise ValueError("independent optimizer validation failed")
    content = {
        "analysis_type": "optimization", "status": result["status"],
        "engine": {"name": OPTIMIZER_ENGINE_NAME, "version": OPTIMIZER_ENGINE_VERSION},
        "inputs": inputs, "limits": limits, "result": result,
    }
    now = datetime.now(timezone.utc)
    row = PlanningAnalysisRun(
        id=str(uuid4()), organization_id=actor.organization_id, project_id=project_id,
        snapshot_id=snapshot.id, analysis_type="optimization", status=result["status"],
        engine_name=OPTIMIZER_ENGINE_NAME, engine_version=OPTIMIZER_ENGINE_VERSION,
        seed=None, inputs_json=dumps(inputs), limits_json=dumps(limits), result_json=dumps(result),
        checksum=analysis_checksum(content), created_by_user_id=actor.user_id,
        correlation_id=command_id, created_at=now,
    )
    db.add(row)
    db.flush()
    for recommendation in result["recommendations"]:
        db.add(PlanningAnalysisRecommendation(
            organization_id=actor.organization_id, project_id=project_id, analysis_run_id=row.id,
            recommendation_key=recommendation["key"], rank=recommendation["rank"], status="proposed",
            title=recommendation["title"], explanation_json=dumps(recommendation["explanation"]),
            proposal_json=dumps(recommendation["proposal"]), preview_json=dumps(recommendation["preview"]),
            source_revision=int(snapshot.source_revision), created_at=now, updated_at=now,
        ))
    db.flush()
    return row


def list_optimizations(db: Session, actor: Actor, project_id: str) -> list[dict[str, Any]]:
    project_or_error(db, actor, project_id)
    rows = db.scalars(select(PlanningAnalysisRun).where(
        PlanningAnalysisRun.organization_id == actor.organization_id,
        PlanningAnalysisRun.project_id == project_id,
        PlanningAnalysisRun.analysis_type == "optimization",
    ).order_by(PlanningAnalysisRun.created_at.desc()).limit(100)).all()
    return [optimization_metadata(db, actor, row) for row in rows]


def optimization_or_error(db: Session, actor: Actor, project_id: str, run_id: str) -> PlanningAnalysisRun:
    project_or_error(db, actor, project_id)
    row = db.scalar(select(PlanningAnalysisRun).where(
        PlanningAnalysisRun.id == run_id, PlanningAnalysisRun.organization_id == actor.organization_id,
        PlanningAnalysisRun.project_id == project_id, PlanningAnalysisRun.analysis_type == "optimization",
    ))
    if not row:
        raise ValueError("optimization_id not found")
    return row


def optimization_metadata(db: Session, actor: Actor, row: PlanningAnalysisRun) -> dict[str, Any]:
    result = loads(row.result_json, {})
    recommendations = list_recommendations(db, actor, row.project_id, row.id)
    return {
        "id": row.id, "project_id": row.project_id, "snapshot_id": row.snapshot_id,
        "analysis_type": row.analysis_type, "status": row.status,
        "engine": {"name": row.engine_name, "version": row.engine_version},
        "checksum": row.checksum, "correlation_id": row.correlation_id,
        "created_at": _timestamp(row.created_at), "objective": result.get("objective", {}),
        "recommendation_count": len(recommendations), "recommendations": recommendations,
        "integrity": analysis_integrity(row),
    }


def optimization_detail(db: Session, actor: Actor, row: PlanningAnalysisRun) -> dict[str, Any]:
    return {
        **optimization_metadata(db, actor, row),
        "inputs": loads(row.inputs_json, {}), "limits": loads(row.limits_json, {}),
        "result": loads(row.result_json, {}),
    }


def list_recommendations(db: Session, actor: Actor, project_id: str, run_id: str | None = None) -> list[dict[str, Any]]:
    project_or_error(db, actor, project_id)
    query = select(PlanningAnalysisRecommendation).where(
        PlanningAnalysisRecommendation.organization_id == actor.organization_id,
        PlanningAnalysisRecommendation.project_id == project_id,
    )
    if run_id:
        query = query.where(PlanningAnalysisRecommendation.analysis_run_id == run_id)
    rows = db.scalars(query.order_by(PlanningAnalysisRecommendation.rank, PlanningAnalysisRecommendation.created_at).limit(200)).all()
    return [recommendation_read_model(row) for row in rows]


def recommendation_or_error(db: Session, actor: Actor, project_id: str, recommendation_id: str) -> PlanningAnalysisRecommendation:
    project_or_error(db, actor, project_id)
    row = db.scalar(select(PlanningAnalysisRecommendation).where(
        PlanningAnalysisRecommendation.id == recommendation_id,
        PlanningAnalysisRecommendation.organization_id == actor.organization_id,
        PlanningAnalysisRecommendation.project_id == project_id,
    ))
    if not row:
        raise ValueError("recommendation_id not found")
    return row


def decide_recommendation(row: PlanningAnalysisRecommendation, actor: Actor, decision: str, reason: str) -> None:
    if row.status != "proposed" or decision not in {"approve", "reject"}:
        raise ValueError("only a proposed recommendation can be approved or rejected")
    row.status = "approved" if decision == "approve" else "rejected"
    row.decision_reason = _reason(reason)
    row.decided_by_user_id = actor.user_id
    row.decided_at = datetime.now(timezone.utc)
    row.updated_at = row.decided_at


def apply_recommendation(db: Session, actor: Actor, row: PlanningAnalysisRecommendation, current_revision: int) -> set[str]:
    if row.status != "approved":
        raise ValueError("recommendation must be approved before apply")
    run = db.get(PlanningAnalysisRun, row.analysis_run_id)
    if not run or run.engine_name != OPTIMIZER_ENGINE_NAME or run.engine_version != OPTIMIZER_ENGINE_VERSION:
        raise ValueError("legacy recommendation cannot be applied; create a new snapshot and rerun optimization")
    snapshot = what_if_or_error(db, actor, row.project_id, run.snapshot_id)
    require_current_snapshot_cpm(loads(snapshot.snapshot_json, {})["approved"])
    _apply_task_changes(db, actor, row, "after")
    changed = apply_schedule(db, actor, row.project_id)
    now = datetime.now(timezone.utc)
    row.status = "applied"
    row.applied_by_user_id = actor.user_id
    row.applied_at = now
    row.applied_revision = current_revision + 1
    row.updated_at = now
    return changed | {str(item["task_id"]) for item in loads(row.proposal_json, {})["task_changes"]}


def rollback_recommendation(db: Session, actor: Actor, row: PlanningAnalysisRecommendation, current_revision: int) -> set[str]:
    if row.status != "applied":
        raise ValueError("only an applied recommendation can be rolled back")
    _apply_task_changes(db, actor, row, "before")
    changed = apply_schedule(db, actor, row.project_id)
    now = datetime.now(timezone.utc)
    row.status = "rolled_back"
    row.rolled_back_by_user_id = actor.user_id
    row.rolled_back_at = now
    row.rollback_revision = current_revision + 1
    row.updated_at = now
    return changed | {str(item["task_id"]) for item in loads(row.proposal_json, {})["task_changes"]}


def recommendation_read_model(row: PlanningAnalysisRecommendation) -> dict[str, Any]:
    return {
        "id": row.id, "project_id": row.project_id, "analysis_run_id": row.analysis_run_id,
        "key": row.recommendation_key, "rank": row.rank, "status": row.status, "title": row.title,
        "source_revision": int(row.source_revision), "explanation": loads(row.explanation_json, {}),
        "proposal": loads(row.proposal_json, {}), "preview": loads(row.preview_json, {}),
        "decision": {"reason": row.decision_reason, "user_id": row.decided_by_user_id, "at": _optional_timestamp(row.decided_at)},
        "application": {"user_id": row.applied_by_user_id, "at": _optional_timestamp(row.applied_at), "revision": row.applied_revision},
        "rollback": {"user_id": row.rolled_back_by_user_id, "at": _optional_timestamp(row.rolled_back_at), "revision": row.rollback_revision},
        "created_at": _timestamp(row.created_at), "updated_at": _timestamp(row.updated_at),
    }


def _apply_task_changes(db: Session, actor: Actor, row: PlanningAnalysisRecommendation, target_side: str) -> None:
    calendar = project_calendar(db, actor, row.project_id)
    for change in loads(row.proposal_json, {})["task_changes"]:
        task = task_or_error(db, actor, str(change["task_id"]), row.project_id)
        expected_side = "before" if target_side == "after" else "after"
        expected = change[expected_side]
        if task.start_at.date().isoformat() != expected["start"] or task.end_at.date().isoformat() != expected["end"]:
            raise ValueError("recommendation is stale because the task dates changed; create a new analysis snapshot")
        target = change[target_side]
        task.start_at = parse_planning_date(target["start"], "start")
        task.end_at = parse_planning_date(target["end"], "end")
        task.duration_days = working_duration(task.start_at.date(), task.end_at.date(), calendar)


def _reason(value: str) -> str:
    text = str(value or "").strip()
    if not 1 <= len(text) <= 500:
        raise ValueError("decision reason must be between 1 and 500 characters")
    return text


def _timestamp(value: datetime) -> str:
    return value.replace(tzinfo=value.tzinfo or timezone.utc).astimezone(timezone.utc).isoformat()


def _optional_timestamp(value: datetime | None) -> str | None:
    return _timestamp(value) if value else None


__all__ = [
    "apply_recommendation", "create_optimization", "decide_recommendation", "list_optimizations",
    "list_recommendations", "optimization_detail", "optimization_metadata", "optimization_or_error",
    "recommendation_or_error", "recommendation_read_model", "rollback_recommendation",
]

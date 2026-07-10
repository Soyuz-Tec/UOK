from __future__ import annotations

import json
from datetime import datetime, timezone
from hashlib import sha256
from hmac import compare_digest
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from .baselines import complete_baseline_snapshot
from .models import PlanningAssignment, PlanningProject, PlanningResource, PlanningTask, PlanningWhatIfSnapshot
from .resource_calendar import resource_calendar_specs
from .resource_capacity import calculate_resource_capacity
from .resource_capacity_validation import validate_resource_capacity_result
from .scheduler import parse_planning_date, project_calendar, project_dependencies, project_or_error, project_tasks, schedule_analysis, validate_schedule
from .schedule_math import working_duration
from uok.security import Actor
from uok.util import dumps, loads

WHAT_IF_SCHEMA_VERSION = 1
MAX_WHAT_IF_CHANGES = 100


def create_what_if_snapshot(
    db: Session,
    actor: Actor,
    project: PlanningProject,
    payload: dict[str, Any],
    command_id: str,
) -> PlanningWhatIfSnapshot:
    snapshot_id = str(uuid4())
    created_at = datetime.now(timezone.utc)
    changes = _task_changes(payload.get("task_changes"))
    approved = complete_baseline_snapshot(
        db, actor, project, baseline_id=snapshot_id, created_at=created_at, correlation_id=command_id,
    )
    approved["capture"] = {
        "what_if_snapshot_id": snapshot_id,
        "created_at": _timestamp(created_at),
        "correlation_id": command_id,
    }
    snapshot = {
        "schema_version": WHAT_IF_SCHEMA_VERSION,
        "source": {
            "project_id": project.id,
            "revision": int(project.revision),
            "captured_at": _timestamp(created_at),
        },
        "proposal": {
            "name": _name(payload.get("name")),
            "task_changes": changes,
            "temporary": True,
        },
        "approved": approved,
        "preview": _preview(db, actor, project, changes),
        "creator": {"user_id": actor.user_id, "username": actor.username},
        "audit": {"correlation_id": command_id},
    }
    checksum = what_if_checksum(snapshot)
    row = PlanningWhatIfSnapshot(
        id=snapshot_id,
        organization_id=actor.organization_id,
        project_id=project.id,
        name=str(snapshot["proposal"]["name"]),
        snapshot_json=dumps(snapshot),
        schema_version=WHAT_IF_SCHEMA_VERSION,
        checksum=checksum,
        source_revision=int(project.revision),
        created_by_user_id=actor.user_id,
        correlation_id=command_id,
        created_at=created_at,
    )
    db.add(row)
    db.flush()
    return row


def list_what_if_snapshots(db: Session, actor: Actor, project_id: str) -> list[dict[str, Any]]:
    project_or_error(db, actor, project_id)
    rows = db.scalars(select(PlanningWhatIfSnapshot).where(
        PlanningWhatIfSnapshot.organization_id == actor.organization_id,
        PlanningWhatIfSnapshot.project_id == project_id,
    ).order_by(PlanningWhatIfSnapshot.created_at.desc()).limit(100)).all()
    return [what_if_metadata(row) for row in rows]


def what_if_or_error(db: Session, actor: Actor, project_id: str, snapshot_id: str) -> PlanningWhatIfSnapshot:
    project_or_error(db, actor, project_id)
    row = db.scalar(select(PlanningWhatIfSnapshot).where(
        PlanningWhatIfSnapshot.id == snapshot_id,
        PlanningWhatIfSnapshot.organization_id == actor.organization_id,
        PlanningWhatIfSnapshot.project_id == project_id,
    ))
    if not row:
        raise ValueError("what_if_snapshot_id not found")
    return row


def what_if_metadata(row: PlanningWhatIfSnapshot) -> dict[str, Any]:
    return {
        "id": row.id,
        "project_id": row.project_id,
        "name": row.name,
        "schema_version": int(row.schema_version),
        "checksum": row.checksum,
        "source_revision": int(row.source_revision),
        "created_by_user_id": row.created_by_user_id,
        "correlation_id": row.correlation_id,
        "created_at": _timestamp(row.created_at),
        "integrity": what_if_integrity(row),
    }


def what_if_detail(row: PlanningWhatIfSnapshot) -> dict[str, Any]:
    snapshot = loads(row.snapshot_json, {})
    return {**what_if_metadata(row), "snapshot": snapshot}


def what_if_integrity(row: PlanningWhatIfSnapshot) -> dict[str, Any]:
    try:
        snapshot = loads(row.snapshot_json, {})
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        return {"status": "corrupt", "verified": False, "message": f"Snapshot JSON is invalid: {exc}"}
    shape_ok = (
        isinstance(snapshot, dict)
        and int(snapshot.get("schema_version") or 0) == int(row.schema_version)
        and snapshot.get("source", {}).get("project_id") == row.project_id
        and snapshot.get("source", {}).get("revision") == row.source_revision
        and snapshot.get("audit", {}).get("correlation_id") == row.correlation_id
    )
    calculated = what_if_checksum(snapshot) if shape_ok else None
    verified = bool(calculated) and compare_digest(str(row.checksum), str(calculated))
    return {
        "status": "verified" if verified else "invalid_snapshot" if not shape_ok else "checksum_mismatch",
        "verified": verified,
        "algorithm": "sha256",
        "calculated_checksum": calculated,
        "message": "What-if snapshot checksum verified." if verified else "What-if snapshot integrity verification failed.",
    }


def what_if_checksum(snapshot: dict[str, Any]) -> str:
    canonical = json.dumps(snapshot, ensure_ascii=False, allow_nan=False, separators=(",", ":"), sort_keys=True)
    return sha256(canonical.encode("utf-8")).hexdigest()


def _preview(db: Session, actor: Actor, project: PlanningProject, changes: list[dict[str, Any]]) -> dict[str, Any]:
    tasks = [_clone_task(task) for task in project_tasks(db, actor, project.id)]
    by_id = {task.id: task for task in tasks}
    calendar = project_calendar(db, actor, project.id)
    for change in changes:
        task = by_id.get(str(change["task_id"]))
        if not task:
            raise ValueError(f"task_id {change['task_id']} not found")
        _apply_change(task, change, calendar)
    dependencies = project_dependencies(db, actor, project.id)
    analysis, cpm_issues = schedule_analysis(tasks, dependencies, calendar, project.start_at.date(), project.target_finish_at.date())
    resources = list(db.scalars(select(PlanningResource).where(
        PlanningResource.organization_id == actor.organization_id,
        PlanningResource.project_id == project.id,
    )).all())
    assignments = _assignments(db, actor, tasks)
    calendars = resource_calendar_specs(db, actor, project.id)
    capacity = calculate_resource_capacity(tasks, resources, assignments, calendar, calendars)
    capacity_issues = validate_resource_capacity_result(tasks, resources, assignments, calendar, capacity, calendars)
    violations = validate_schedule(tasks, dependencies, calendar)
    return {
        "tasks": [
            {"id": task.id, "start": task.start_at.date().isoformat(), "end": task.end_at.date().isoformat(), "duration_days": task.duration_days, "progress": task.progress}
            for task in sorted(tasks, key=lambda item: (item.sort_order, item.id))
        ],
        "calculation": {
            "engine_version": analysis.engine_version,
            "calculated_finish": analysis.calculated_finish.isoformat(),
            "target_finish": analysis.target_finish.isoformat(),
            "target_variance_days": analysis.target_variance_days,
            "resource_capacity": capacity.as_dict(),
        },
        "validation": {
            "ok": not violations and not cpm_issues and not capacity_issues,
            "violations": violations + [issue.message for issue in (*cpm_issues, *capacity_issues)],
            "independent_issue_count": len(cpm_issues) + len(capacity_issues),
        },
    }


def _clone_task(task: PlanningTask) -> PlanningTask:
    return PlanningTask(
        id=task.id, organization_id=task.organization_id, project_id=task.project_id,
        parent_task_id=task.parent_task_id, title=task.title, task_type=task.task_type,
        status=task.status, start_at=task.start_at, end_at=task.end_at,
        forecast_start_at=task.forecast_start_at, forecast_end_at=task.forecast_end_at,
        actual_start_at=task.actual_start_at, actual_end_at=task.actual_end_at,
        deadline_at=task.deadline_at, duration_days=task.duration_days, progress=task.progress,
        sort_order=task.sort_order, version=task.version, attrs_json=task.attrs_json,
        created_at=task.created_at, updated_at=task.updated_at,
    )


def _apply_change(task: PlanningTask, change: dict[str, Any], calendar: Any) -> None:
    start = parse_planning_date(change.get("start") or task.start_at, "start")
    end = parse_planning_date(change.get("end") or task.end_at, "end")
    if end < start:
        raise ValueError("what-if task end must be on or after start")
    task.start_at = start
    task.end_at = start if task.task_type == "milestone" else end
    task.duration_days = 0 if task.task_type == "milestone" else working_duration(start.date(), end.date(), calendar)
    if "progress" in change:
        task.progress = int(change["progress"])


def _task_changes(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list) or not 1 <= len(value) <= MAX_WHAT_IF_CHANGES:
        raise ValueError(f"task_changes must contain between 1 and {MAX_WHAT_IF_CHANGES} changes")
    found: set[str] = set()
    changes: list[dict[str, Any]] = []
    for raw in value:
        if not isinstance(raw, dict):
            raise ValueError("each task change must be an object")
        task_id = str(raw.get("task_id") or "").strip()
        if not task_id or task_id in found:
            raise ValueError("task_changes must contain unique task_id values")
        change = {"task_id": task_id}
        for field in ("start", "end"):
            if raw.get(field) is not None:
                change[field] = parse_planning_date(raw[field], field).date().isoformat()
        if raw.get("progress") is not None:
            progress = int(raw["progress"])
            if not 0 <= progress <= 100:
                raise ValueError("what-if progress must be between 0 and 100")
            change["progress"] = progress
        if len(change) == 1:
            raise ValueError("each task change must propose start, end, or progress")
        found.add(task_id)
        changes.append(change)
    return changes


def _assignments(db: Session, actor: Actor, tasks: list[PlanningTask]) -> list[Any]:
    task_ids = [task.id for task in tasks]
    return list(db.scalars(select(PlanningAssignment).where(
        PlanningAssignment.organization_id == actor.organization_id,
        PlanningAssignment.task_id.in_(task_ids),
    )).all()) if task_ids else []
def _name(value: Any) -> str:
    text = str(value or "What-if snapshot").strip()
    if not 2 <= len(text) <= 120:
        raise ValueError("name must be between 2 and 120 characters")
    return text


def _timestamp(value: datetime) -> str:
    if value.tzinfo is None or value.utcoffset() is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


__all__ = [
    "WHAT_IF_SCHEMA_VERSION",
    "create_what_if_snapshot",
    "list_what_if_snapshots",
    "what_if_checksum",
    "what_if_detail",
    "what_if_integrity",
    "what_if_metadata",
    "what_if_or_error",
]

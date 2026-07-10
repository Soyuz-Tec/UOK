from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from .baselines import COMPLETE_BASELINE_SCHEMA_VERSION, baseline_checksum, complete_baseline_snapshot
from .link_resolver import resolve_target
from .models import PlanningAssignment, PlanningBaseline, PlanningCalendar, PlanningResource
from .planning_audit import add_planning_schedule_event, emit_planning_event
from .read_model import schedule_read_model
from .resource_contract import resource_definition
from .scheduler import apply_schedule, parse_planning_date, project_or_error, task_or_error
from uok.security import Actor
from uok.util import dumps


def cmd_set_calendar(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    project = project_or_error(db, actor, clean_text(payload.get("project_id"), "project_id", 36))
    row = db.scalars(select(PlanningCalendar).where(
        PlanningCalendar.organization_id == actor.organization_id,
        PlanningCalendar.project_id == project.id,
    )).first()
    if not row:
        row = PlanningCalendar(organization_id=actor.organization_id, project_id=project.id, name="Standard")
        db.add(row)
    row.name = clean_text(payload.get("name") or "Standard", "name", 120)
    row.working_days_json = dumps(_working_days(payload.get("working_days")))
    row.holidays_json = dumps({
        "holidays": [parse_planning_date(item, "holiday").date().isoformat() for item in payload.get("holidays", [])],
        "ignored_periods": _ignored_periods(payload.get("ignored_periods", [])),
    })
    db.flush()
    changed = apply_schedule(db, actor, project.id)
    emit_planning_event(db, actor, command_id, "PlanningCalendarUpdated", "PlanningCalendar", row.id, {"project_id": project.id})
    add_planning_schedule_event(db, actor, command_id, project.id, "calendar_updated", {"changed_task_ids": sorted(changed)})
    return schedule_read_model(db, actor, project)


def cmd_create_baseline(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    project = project_or_error(db, actor, clean_text(payload.get("project_id"), "project_id", 36))
    baseline_id = str(uuid4())
    created_at = datetime.now(timezone.utc)
    snapshot = complete_baseline_snapshot(
        db,
        actor,
        project,
        baseline_id=baseline_id,
        created_at=created_at,
        correlation_id=command_id,
    )
    checksum = baseline_checksum(snapshot)
    row = PlanningBaseline(
        id=baseline_id,
        organization_id=actor.organization_id,
        project_id=project.id,
        name=clean_text(payload.get("name") or "Baseline", "name", 120),
        snapshot_json=dumps(snapshot),
        schema_version=COMPLETE_BASELINE_SCHEMA_VERSION,
        completeness="complete",
        checksum=checksum,
        source_revision=int(project.revision),
        created_by_user_id=actor.user_id,
        correlation_id=command_id,
        created_at=created_at,
    )
    db.add(row)
    db.flush()
    evidence = {
        "project_id": project.id,
        "schema_version": COMPLETE_BASELINE_SCHEMA_VERSION,
        "source_revision": int(project.revision),
        "checksum": checksum,
        "correlation_id": command_id,
    }
    emit_planning_event(db, actor, command_id, "PlanningBaselineCreated", "PlanningBaseline", row.id, evidence)
    add_planning_schedule_event(db, actor, command_id, project.id, "baseline_created", {"baseline_id": row.id, **evidence})
    return schedule_read_model(db, actor, project)


def cmd_create_resource(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    project = project_or_error(db, actor, clean_text(payload.get("project_id"), "project_id", 36))
    definition = resource_definition(payload)
    if definition.canonical_target_kind and definition.canonical_target_id:
        resolution = resolve_target(db, actor, definition.canonical_target_kind, definition.canonical_target_id)
        if resolution.status in {"missing", "denied"}:
            raise ValueError(f"canonical target cannot be used: {resolution.status_summary}")
    row = PlanningResource(
        organization_id=actor.organization_id,
        project_id=project.id,
        name=clean_text(payload.get("name"), "name", 160),
        role=str(payload.get("role") or "")[:120],
        resource_type=definition.resource_type,
        capacity_value=definition.capacity_value,
        capacity_unit=definition.capacity_unit,
        canonical_target_kind=definition.canonical_target_kind,
        canonical_target_id=definition.canonical_target_id,
        effective_start=definition.effective_start,
        effective_end=definition.effective_end,
    )
    db.add(row)
    db.flush()
    evidence = {
        "project_id": project.id,
        "resource_type": row.resource_type,
        "capacity_value": str(row.capacity_value),
        "capacity_unit": row.capacity_unit,
    }
    emit_planning_event(db, actor, command_id, "PlanningResourceCreated", "PlanningResource", row.id, evidence)
    add_planning_schedule_event(db, actor, command_id, project.id, "resource_created", {"resource_id": row.id, **evidence})
    return schedule_read_model(db, actor, project)


def cmd_assign_resource(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    task = task_or_error(db, actor, clean_text(payload.get("task_id"), "task_id", 36))
    resource = _resource_or_error(db, actor, clean_text(payload.get("resource_id"), "resource_id", 36))
    if task.project_id != resource.project_id:
        raise ValueError("resource_id is not part of the task project")
    existing = db.scalars(select(PlanningAssignment).where(
        PlanningAssignment.organization_id == actor.organization_id,
        PlanningAssignment.task_id == task.id,
        PlanningAssignment.resource_id == resource.id,
    )).first()
    assignment = existing or PlanningAssignment(organization_id=actor.organization_id, task_id=task.id, resource_id=resource.id)
    assignment.allocation_percent = bounded_int(payload.get("allocation_percent", 100), "allocation_percent", 1, 300)
    db.add(assignment)
    db.flush()
    emit_planning_event(db, actor, command_id, "PlanningResourceAssigned", "PlanningAssignment", assignment.id, {"project_id": task.project_id})
    add_planning_schedule_event(db, actor, command_id, task.project_id, "resource_assigned", {"assignment_id": assignment.id})
    return schedule_read_model(db, actor, project_or_error(db, actor, task.project_id))


def clean_text(value: Any, field: str, limit: int) -> str:
    text = str(value or "").strip()
    if not text:
        raise ValueError(f"{field} is required")
    if len(text) > limit:
        raise ValueError(f"{field} must be {limit} characters or fewer")
    return text


def bounded_int(value: Any, field: str, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field} must be a number") from exc
    if parsed < minimum or parsed > maximum:
        raise ValueError(f"{field} must be between {minimum} and {maximum}")
    return parsed


def _resource_or_error(db: Session, actor: Actor, resource_id: str) -> PlanningResource:
    resource = db.get(PlanningResource, resource_id)
    if not resource or resource.organization_id != actor.organization_id:
        raise ValueError("resource_id not found")
    return resource


def _working_days(value: Any) -> list[int]:
    days = [int(item) for item in (value or [1, 2, 3, 4, 5])]
    if not days or any(item < 1 or item > 7 for item in days):
        raise ValueError("working_days must contain ISO weekday numbers from 1 to 7")
    return sorted(set(days))


def _ignored_periods(value: Any) -> list[dict[str, str]]:
    periods: list[dict[str, str]] = []
    for index, item in enumerate(value or [], start=1):
        text = str(item).strip()
        if not text:
            continue
        if ".." in text:
            start_text, end_text = [part.strip() for part in text.split("..", 1)]
        else:
            start_text = end_text = text
        start = parse_planning_date(start_text, f"ignored_period_{index}_start").date()
        end = parse_planning_date(end_text, f"ignored_period_{index}_end").date()
        if end < start:
            raise ValueError("ignored period end must be on or after start")
        if (end - start).days > 366:
            raise ValueError("ignored periods must be 366 days or fewer")
        periods.append({"start": start.isoformat(), "end": end.isoformat()})
    return periods

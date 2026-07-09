from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import PlanningAssignment, PlanningBaseline, PlanningCalendar, PlanningResource, PlanningScheduleEvent
from .read_model import baseline_snapshot, schedule_read_model
from .scheduler import apply_schedule, parse_planning_date, project_or_error, project_tasks, task_or_error
from uok.models import EventRecord
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
    row.name = str(payload.get("name") or "Standard")[:120]
    row.working_days_json = dumps(_working_days(payload.get("working_days")))
    row.holidays_json = dumps([parse_planning_date(item, "holiday").date().isoformat() for item in payload.get("holidays", [])])
    db.flush()
    changed = apply_schedule(db, actor, project.id)
    _emit(db, actor, "PlanningCalendarUpdated", "PlanningCalendar", row.id, {"project_id": project.id})
    _schedule_event(db, actor, project.id, "calendar_updated", {"changed_task_ids": sorted(changed)})
    return schedule_read_model(db, actor, project)


def cmd_create_baseline(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    project = project_or_error(db, actor, clean_text(payload.get("project_id"), "project_id", 36))
    row = PlanningBaseline(
        organization_id=actor.organization_id,
        project_id=project.id,
        name=clean_text(payload.get("name") or "Baseline", "name", 120),
        snapshot_json=dumps(baseline_snapshot(project_tasks(db, actor, project.id))),
    )
    db.add(row)
    db.flush()
    _emit(db, actor, "PlanningBaselineCreated", "PlanningBaseline", row.id, {"project_id": project.id})
    _schedule_event(db, actor, project.id, "baseline_created", {"baseline_id": row.id})
    return schedule_read_model(db, actor, project)


def cmd_create_resource(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    project = project_or_error(db, actor, clean_text(payload.get("project_id"), "project_id", 36))
    row = PlanningResource(
        organization_id=actor.organization_id,
        project_id=project.id,
        name=clean_text(payload.get("name"), "name", 160),
        role=str(payload.get("role") or "")[:120],
    )
    db.add(row)
    db.flush()
    _emit(db, actor, "PlanningResourceCreated", "PlanningResource", row.id, {"project_id": project.id})
    _schedule_event(db, actor, project.id, "resource_created", {"resource_id": row.id})
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
    _emit(db, actor, "PlanningResourceAssigned", "PlanningAssignment", assignment.id, {"project_id": task.project_id})
    _schedule_event(db, actor, task.project_id, "resource_assigned", {"assignment_id": assignment.id})
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


def _emit(db: Session, actor: Actor, event_type: str, object_type: str, object_id: str, payload: dict[str, Any]) -> None:
    last = db.scalar(select(func.max(EventRecord.sequence)).where(EventRecord.organization_id == actor.organization_id)) or 0
    db.add(EventRecord(
        organization_id=actor.organization_id,
        sequence=int(last) + 1,
        event_type=event_type,
        object_type=object_type,
        object_id=object_id,
        payload_json=dumps({"actor_user_id": actor.user_id, **payload}),
    ))


def _schedule_event(db: Session, actor: Actor, project_id: str, event_type: str, payload: dict[str, Any]) -> None:
    db.add(PlanningScheduleEvent(
        organization_id=actor.organization_id,
        project_id=project_id,
        event_type=event_type,
        payload_json=dumps(payload),
    ))

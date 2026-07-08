from __future__ import annotations

from typing import Any, Callable

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import PlanningProject, PlanningScheduleEvent, PlanningTask, PlanningTaskDependency, utcnow
from .read_model import schedule_read_model, serialize_project, serialize_task
from .scheduler import parse_planning_date, project_or_error, project_tasks, task_or_error, validate_schedule
from uok.models import EventRecord
from uok.security import Actor
from uok.util import dumps

CommandHandler = Callable[[Session, Actor, dict[str, Any], str], dict[str, Any]]


def cmd_create_project(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    name = clean_text(payload.get("name"), "name", 180)
    start = parse_planning_date(payload.get("start"), "start")
    end = parse_planning_date(payload.get("end"), "end")
    if end < start:
        raise ValueError("project end must be on or after start")
    project = PlanningProject(organization_id=actor.organization_id, name=name, start_at=start, end_at=end, updated_at=utcnow())
    db.add(project)
    db.flush()
    _emit(db, actor, "PlanningProjectCreated", "PlanningProject", project.id, {"name": name})
    _schedule_event(db, actor, project.id, "project_created", {"name": name})
    return serialize_project(project)


def cmd_create_task(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    project = project_or_error(db, actor, clean_text(payload.get("project_id"), "project_id", 36))
    task = _task_from_payload(actor, project.id, payload)
    db.add(task)
    project.updated_at = utcnow()
    db.flush()
    _assert_schedule_valid(db, actor, project.id)
    _emit(db, actor, "PlanningTaskCreated", "PlanningTask", task.id, {"project_id": project.id, "title": task.title})
    _schedule_event(db, actor, project.id, "task_created", {"task_id": task.id})
    return serialize_task(task)


def cmd_update_task(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    task = task_or_error(db, actor, clean_text(payload.get("task_id"), "task_id", 36))
    project = project_or_error(db, actor, task.project_id)
    if "title" in payload:
        task.title = clean_text(payload.get("title"), "title", 180)
    if "start" in payload:
        task.start_at = parse_planning_date(payload.get("start"), "start")
    if "end" in payload:
        task.end_at = parse_planning_date(payload.get("end"), "end")
    if task.end_at < task.start_at:
        raise ValueError("task end must be on or after start")
    if "status" in payload:
        task.status = clean_text(payload.get("status"), "status", 40)
    if "progress" in payload:
        task.progress = bounded_int(payload.get("progress"), "progress", 0, 100)
    if "sort_order" in payload:
        task.sort_order = bounded_int(payload.get("sort_order"), "sort_order", 0, 100000)
    task.duration_days = max(1, (task.end_at.date() - task.start_at.date()).days + 1)
    task.updated_at = utcnow()
    project.updated_at = task.updated_at
    _assert_schedule_valid(db, actor, project.id)
    _emit(db, actor, "PlanningTaskUpdated", "PlanningTask", task.id, {"project_id": project.id, "title": task.title})
    _schedule_event(db, actor, project.id, "task_updated", {"task_id": task.id})
    return {"task": serialize_task(task), "validation": schedule_read_model(db, actor, project)["validation"]}


def cmd_link_tasks(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    project = project_or_error(db, actor, clean_text(payload.get("project_id"), "project_id", 36))
    predecessor = task_or_error(db, actor, clean_text(payload.get("predecessor_task_id"), "predecessor_task_id", 36), project.id)
    successor = task_or_error(db, actor, clean_text(payload.get("successor_task_id"), "successor_task_id", 36), project.id)
    dep = PlanningTaskDependency(
        organization_id=actor.organization_id,
        project_id=project.id,
        predecessor_task_id=predecessor.id,
        successor_task_id=successor.id,
        dependency_type=clean_text(payload.get("dependency_type") or "finish_to_start", "dependency_type", 20),
        lag_days=bounded_int(payload.get("lag_days", 0), "lag_days", 0, 30),
    )
    db.add(dep)
    project.updated_at = utcnow()
    db.flush()
    _assert_schedule_valid(db, actor, project.id)
    _emit(db, actor, "PlanningTaskLinked", "PlanningTaskDependency", dep.id, {"project_id": project.id})
    _schedule_event(db, actor, project.id, "task_linked", {"dependency_id": dep.id})
    return schedule_read_model(db, actor, project)


def command_handlers() -> dict[str, CommandHandler]:
    return {
        "CreatePlanningProject": cmd_create_project,
        "CreatePlanningTask": cmd_create_task,
        "UpdatePlanningTask": cmd_update_task,
        "LinkPlanningTasks": cmd_link_tasks,
    }


def command_permissions() -> dict[str, str]:
    return {command: "planning.manage" for command in command_handlers()}


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


def _task_from_payload(actor: Actor, project_id: str, payload: dict[str, Any]) -> PlanningTask:
    start = parse_planning_date(payload.get("start"), "start")
    end = parse_planning_date(payload.get("end"), "end")
    if end < start:
        raise ValueError("task end must be on or after start")
    task_type = str(payload.get("task_type") or "task")
    if task_type not in {"task", "summary", "milestone"}:
        raise ValueError("task_type must be task, summary, or milestone")
    return PlanningTask(
        organization_id=actor.organization_id,
        project_id=project_id,
        parent_task_id=str(payload["parent_task_id"]) if payload.get("parent_task_id") else None,
        title=clean_text(payload.get("title"), "title", 180),
        task_type=task_type,
        status=str(payload.get("status") or "planned")[:40],
        start_at=start,
        end_at=end,
        duration_days=max(1, (end.date() - start.date()).days + 1),
        progress=bounded_int(payload.get("progress", 0), "progress", 0, 100),
        sort_order=bounded_int(payload.get("sort_order", 0), "sort_order", 0, 100000),
        updated_at=utcnow(),
    )


def _assert_schedule_valid(db: Session, actor: Actor, project_id: str) -> None:
    violations = validate_schedule(project_tasks(db, actor, project_id), list(db.scalars(select(PlanningTaskDependency).where(
        PlanningTaskDependency.organization_id == actor.organization_id,
        PlanningTaskDependency.project_id == project_id,
    )).all()))
    if violations:
        raise ValueError("; ".join(violations))


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

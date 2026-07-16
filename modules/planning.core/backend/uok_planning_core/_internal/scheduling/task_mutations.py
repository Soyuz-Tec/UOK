from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from uok_planning_core._internal.scheduling.advanced_commands import bounded_int, clean_text
from uok_planning_core._internal.persistence.models import PlanningProject, PlanningTask, utcnow
from uok_planning_core._internal.scheduling.schedule_math import working_duration
from uok_planning_core._internal.scheduling.scheduler import parse_planning_date, project_calendar, task_or_error
from uok_planning_core._internal.scheduling.status_policy import assert_task_status_transition, planning_task_status
from uok_planning_core._internal.scheduling.task_constraints import set_task_planning_attrs
from uok.security import Actor


def apply_task_update(
    db: Session,
    actor: Actor,
    project: PlanningProject,
    task: PlanningTask,
    payload: dict[str, Any],
    command_id: str,
) -> None:
    if task.project_id != project.id:
        raise ValueError("task_id is not part of the project")
    if "title" in payload:
        task.title = clean_text(payload.get("title"), "title", 180)
    if "task_type" in payload:
        task.task_type = planning_task_type(payload.get("task_type"))
    if "parent_task_id" in payload:
        parent_id = str(payload["parent_task_id"]) if payload.get("parent_task_id") else None
        assert_parent_valid(db, actor, project.id, parent_id, task.id)
        task.parent_task_id = parent_id
    if "start" in payload:
        task.start_at = parse_planning_date(payload.get("start"), "start")
    if "end" in payload:
        task.end_at = parse_planning_date(payload.get("end"), "end")
    if task.end_at.date() < task.start_at.date():
        raise ValueError("task end must be on or after start")
    if "status" in payload:
        target_status = planning_task_status(payload.get("status"))
        assert_task_status_transition(
            task.status,
            target_status,
            task_id=task.id,
            current_revision=int(project.revision),
            command_id=command_id,
        )
        task.status = target_status
    if "progress" in payload:
        task.progress = bounded_int(payload.get("progress"), "progress", 0, 100)
    if "sort_order" in payload:
        task.sort_order = bounded_int(payload.get("sort_order"), "sort_order", 0, 100000)
    set_task_planning_attrs(task, payload)
    recalculate_task_duration(task, project_calendar(db, actor, project.id))
    task.updated_at = utcnow()
    project.updated_at = task.updated_at


def assert_parent_valid(
    db: Session,
    actor: Actor,
    project_id: str,
    parent_id: str | None,
    task_id: str | None = None,
) -> None:
    if not parent_id:
        return
    parent = task_or_error(db, actor, parent_id, project_id)
    if parent.id == task_id:
        raise ValueError("task cannot be its own parent")


def planning_task_type(value: Any) -> str:
    task_type = str(value or "task")
    if task_type not in {"task", "summary", "milestone"}:
        raise ValueError("task_type must be task, summary, or milestone")
    return task_type


def recalculate_task_duration(task: PlanningTask, calendar: Any | None = None) -> None:
    if task.task_type == "milestone":
        task.duration_days = 0
        task.end_at = task.start_at
        return
    if calendar:
        task.duration_days = max(1, working_duration(task.start_at.date(), task.end_at.date(), calendar))
    else:
        task.duration_days = max(1, (task.end_at.date() - task.start_at.date()).days + 1)

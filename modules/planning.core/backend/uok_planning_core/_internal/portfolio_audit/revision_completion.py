from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok_planning_core._internal.persistence.models import PlanningProject, PlanningTask, utcnow
from uok_planning_core._internal.portfolio_audit.revision_history import record_schedule_revision
from uok_planning_core._internal.scheduling.task_aggregate_state import task_context_states
from uok.kernel.security import Actor


def finish_project_revision(
    db: Session,
    actor: Actor,
    project: PlanningProject,
    previous_task_states: dict[str, tuple[Any, ...]] | None,
    *,
    command_type: str,
    correlation_id: str,
    source_command_id: str | None,
) -> None:
    changed_task_ids: set[str] = set()
    if previous_task_states is None:
        previous_revision = 0
    else:
        current_states = task_states(db, actor, project.id)
        changed_task_ids = {
            task_id
            for task_id in set(previous_task_states) | set(current_states)
            if previous_task_states.get(task_id) != current_states.get(task_id)
        }
        for task in _all_project_tasks(db, actor, project.id):
            previous = previous_task_states.get(task.id)
            if previous is not None and previous != current_states.get(task.id):
                task.version = int(task.version) + 1
        previous_revision = int(project.revision)
        project.revision = previous_revision + 1
        project.updated_at = utcnow()
        db.flush()
    record_schedule_revision(
        db,
        actor,
        project,
        previous_revision=previous_revision,
        command_type=command_type,
        correlation_id=correlation_id,
        source_command_id=source_command_id,
        changed_task_ids=changed_task_ids,
    )


def task_states(db: Session, actor: Actor, project_id: str) -> dict[str, tuple[Any, ...]]:
    context = task_context_states(db, actor, project_id)
    return {task.id: _task_state(task, context.get(task.id, ())) for task in _all_project_tasks(db, actor, project_id)}


def _all_project_tasks(db: Session, actor: Actor, project_id: str) -> list[PlanningTask]:
    return list(db.scalars(select(PlanningTask).where(
        PlanningTask.organization_id == actor.organization_id,
        PlanningTask.project_id == project_id,
    )).all())


def _task_state(task: PlanningTask, context: tuple[tuple[object, ...], ...] = ()) -> tuple[Any, ...]:
    return (
        task.parent_task_id,
        task.title,
        task.task_type,
        task.status,
        task.start_at,
        task.end_at,
        task.forecast_start_at,
        task.forecast_end_at,
        task.actual_start_at,
        task.actual_end_at,
        task.deadline_at,
        task.duration_days,
        task.progress,
        task.sort_order,
        task.attrs_json,
        context,
    )


__all__ = ["finish_project_revision", "task_states"]

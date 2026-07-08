from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import PlanningProject, PlanningTask, PlanningTaskDependency
from .scheduler import critical_task_ids, project_dependencies, project_tasks, validate_schedule
from uok.security import Actor


def list_projects(db: Session, actor: Actor) -> list[dict[str, Any]]:
    rows = db.scalars(select(PlanningProject).where(
        PlanningProject.organization_id == actor.organization_id,
        PlanningProject.status != "purged",
    ).order_by(PlanningProject.updated_at.desc())).all()
    return [serialize_project(row) for row in rows]


def schedule_read_model(db: Session, actor: Actor, project: PlanningProject) -> dict[str, Any]:
    tasks = project_tasks(db, actor, project.id)
    dependencies = project_dependencies(db, actor, project.id)
    critical = critical_task_ids(tasks, dependencies)
    violations = validate_schedule(tasks, dependencies)
    return {
        "project": serialize_project(project),
        "tasks": [serialize_task(task, task.id in critical) for task in tasks],
        "dependencies": [serialize_dependency(dep) for dep in dependencies],
        "validation": {"ok": not violations, "violations": violations},
    }


def serialize_project(project: PlanningProject) -> dict[str, Any]:
    return {
        "id": project.id,
        "name": project.name,
        "status": project.status,
        "start": project.start_at.date().isoformat(),
        "end": project.end_at.date().isoformat(),
        "updated_at": project.updated_at.isoformat() if project.updated_at else None,
    }


def serialize_task(task: PlanningTask, critical: bool = False) -> dict[str, Any]:
    return {
        "id": task.id,
        "project_id": task.project_id,
        "parent_task_id": task.parent_task_id,
        "title": task.title,
        "task_type": task.task_type,
        "status": task.status,
        "start": task.start_at.date().isoformat(),
        "end": task.end_at.date().isoformat(),
        "duration_days": task.duration_days,
        "progress": task.progress,
        "sort_order": task.sort_order,
        "critical": critical,
    }


def serialize_dependency(dep: PlanningTaskDependency) -> dict[str, Any]:
    return {
        "id": dep.id,
        "project_id": dep.project_id,
        "predecessor_task_id": dep.predecessor_task_id,
        "successor_task_id": dep.successor_task_id,
        "dependency_type": dep.dependency_type,
        "lag_days": dep.lag_days,
    }

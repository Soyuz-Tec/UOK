from __future__ import annotations

from collections import defaultdict, deque
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import PlanningProject, PlanningTask, PlanningTaskDependency
from uok.security import Actor


def parse_planning_date(value: Any, field: str) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, date):
        return datetime.combine(value, time.min, tzinfo=timezone.utc)
    text = str(value or "").strip()
    if not text:
        raise ValueError(f"{field} is required")
    try:
        if len(text) == 10:
            return datetime.combine(date.fromisoformat(text), time.min, tzinfo=timezone.utc)
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError as exc:
        raise ValueError(f"{field} must be an ISO date") from exc


def project_or_error(db: Session, actor: Actor, project_id: str) -> PlanningProject:
    project = db.get(PlanningProject, project_id)
    if not project or project.organization_id != actor.organization_id:
        raise ValueError("project_id not found")
    return project


def task_or_error(db: Session, actor: Actor, task_id: str, project_id: str | None = None) -> PlanningTask:
    task = db.get(PlanningTask, task_id)
    if not task or task.organization_id != actor.organization_id:
        raise ValueError("task_id not found")
    if project_id and task.project_id != project_id:
        raise ValueError("task_id is not part of the project")
    return task


def project_tasks(db: Session, actor: Actor, project_id: str) -> list[PlanningTask]:
    return list(db.scalars(select(PlanningTask).where(
        PlanningTask.organization_id == actor.organization_id,
        PlanningTask.project_id == project_id,
    ).order_by(PlanningTask.sort_order, PlanningTask.created_at)).all())


def project_dependencies(db: Session, actor: Actor, project_id: str) -> list[PlanningTaskDependency]:
    return list(db.scalars(select(PlanningTaskDependency).where(
        PlanningTaskDependency.organization_id == actor.organization_id,
        PlanningTaskDependency.project_id == project_id,
    )).all())


def validate_schedule(tasks: list[PlanningTask], dependencies: list[PlanningTaskDependency]) -> list[str]:
    task_ids = {task.id for task in tasks}
    violations: list[str] = []
    graph: dict[str, list[str]] = defaultdict(list)
    indegree = {task_id: 0 for task_id in task_ids}
    for dep in dependencies:
        if dep.predecessor_task_id not in task_ids or dep.successor_task_id not in task_ids:
            violations.append("dependency references a missing task")
            continue
        if dep.predecessor_task_id == dep.successor_task_id:
            violations.append("dependency cannot link a task to itself")
            continue
        graph[dep.predecessor_task_id].append(dep.successor_task_id)
        indegree[dep.successor_task_id] += 1
        predecessor = next(task for task in tasks if task.id == dep.predecessor_task_id)
        successor = next(task for task in tasks if task.id == dep.successor_task_id)
        earliest = predecessor.end_at.date() + timedelta(days=dep.lag_days)
        if dep.dependency_type == "finish_to_start" and successor.start_at.date() < earliest:
            violations.append(f"{successor.title} starts before {predecessor.title} finishes")
    visited = _topological_count(indegree, graph)
    if visited != len(task_ids):
        violations.append("schedule contains a dependency cycle")
    return violations


def critical_task_ids(tasks: list[PlanningTask], dependencies: list[PlanningTaskDependency]) -> set[str]:
    if not tasks:
        return set()
    graph: dict[str, list[str]] = defaultdict(list)
    indegree = {task.id: 0 for task in tasks}
    durations = {task.id: max(1, int(task.duration_days or 1)) for task in tasks}
    scores = {task.id: durations[task.id] for task in tasks}
    previous: dict[str, str] = {}
    for dep in dependencies:
        graph[dep.predecessor_task_id].append(dep.successor_task_id)
        indegree[dep.successor_task_id] = indegree.get(dep.successor_task_id, 0) + 1
    queue = deque(task_id for task_id, value in indegree.items() if value == 0)
    while queue:
        current = queue.popleft()
        for successor in graph[current]:
            candidate = scores[current] + durations.get(successor, 1)
            if candidate > scores.get(successor, 0):
                scores[successor] = candidate
                previous[successor] = current
            indegree[successor] -= 1
            if indegree[successor] == 0:
                queue.append(successor)
    end = max(scores, key=scores.get)
    path = {end}
    while end in previous:
        end = previous[end]
        path.add(end)
    return path


def _topological_count(indegree: dict[str, int], graph: dict[str, list[str]]) -> int:
    queue = deque(task_id for task_id, value in indegree.items() if value == 0)
    visited = 0
    while queue:
        current = queue.popleft()
        visited += 1
        for successor in graph[current]:
            indegree[successor] -= 1
            if indegree[successor] == 0:
                queue.append(successor)
    return visited

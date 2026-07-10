from __future__ import annotations

from collections import Counter
from time import perf_counter
from typing import Any

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import Session

from .models import PlanningLink, PlanningProject, PlanningTask, PlanningTaskDependency, PlanningTaskRequirement, utcnow
from uok.security import Actor


def planning_portfolio_read_model(
    db: Session,
    actor: Actor,
    query: str = "",
    status: str = "",
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    started = perf_counter()
    filters = [PlanningProject.organization_id == actor.organization_id, PlanningProject.status != "purged"]
    if query:
        filters.append(PlanningProject.name.contains(query, autoescape=True))
    if status:
        filters.append(PlanningProject.status == status)
    total = int(db.scalar(select(func.count()).select_from(PlanningProject).where(*filters)) or 0)
    projects = list(db.scalars(select(PlanningProject).where(*filters).order_by(
        PlanningProject.updated_at.desc(), PlanningProject.id.desc()
    ).offset(offset).limit(limit)).all())
    project_ids = [project.id for project in projects]
    if not project_ids:
        return _response([], total, query, status, limit, offset, 2, started)

    task_rows = _rows_by_project(db.execute(select(
        PlanningTask.project_id,
        func.count().label("task_count"),
        func.sum(case((PlanningTask.status == "complete", 1), else_=0)).label("completed"),
        func.sum(case((PlanningTask.status == "in_progress", 1), else_=0)).label("in_progress"),
        func.sum(case((PlanningTask.status == "blocked", 1), else_=0)).label("blocked"),
        func.sum(case((PlanningTask.task_type == "milestone", 1), else_=0)).label("milestones"),
        func.sum(case((and_(PlanningTask.deadline_at.is_not(None), PlanningTask.deadline_at < utcnow(), PlanningTask.status != "complete"), 1), else_=0)).label("overdue"),
        func.avg(PlanningTask.progress).label("progress"),
    ).where(
        PlanningTask.organization_id == actor.organization_id,
        PlanningTask.project_id.in_(project_ids),
        PlanningTask.status != "deleted",
    ).group_by(PlanningTask.project_id)))
    dependency_rows = _count_by_project(db, PlanningTaskDependency, actor, project_ids)
    gate_rows = _gate_blockers(db, actor, project_ids)
    link_rows = _link_blockers(db, actor, project_ids)
    rows = [
        _project_row(project, task_rows.get(project.id, {}), dependency_rows.get(project.id, 0), gate_rows.get(project.id, 0), link_rows.get(project.id, 0))
        for project in projects
    ]
    return _response(rows, total, query, status, limit, offset, 6, started)


def _project_row(project: PlanningProject, tasks: Any, dependencies: int, gates: int, links: int) -> dict[str, Any]:
    task_count = int(tasks.get("task_count") or 0)
    overdue = int(tasks.get("overdue") or 0)
    blocked = int(tasks.get("blocked") or 0)
    project_overdue = project.end_at.date() < utcnow().date() and project.status not in {"complete", "completed", "archived"}
    health = "blocked" if blocked or gates or links else "attention" if overdue or project_overdue else "on_track"
    return {
        "id": project.id, "name": project.name, "status": project.status,
        "start": project.start_at.date().isoformat(), "end": project.end_at.date().isoformat(),
        "timezone": project.timezone_name, "revision": int(project.revision),
        "updated_at": project.updated_at.isoformat() if project.updated_at else None,
        "metrics": {
            "task_count": task_count, "completed_task_count": int(tasks.get("completed") or 0),
            "in_progress_task_count": int(tasks.get("in_progress") or 0), "blocked_task_count": blocked,
            "milestone_count": int(tasks.get("milestones") or 0), "dependency_count": dependencies,
            "completion_percent": round(float(tasks.get("progress") or 0)),
        },
        "attention": {
            "health": health, "overdue_task_count": overdue, "gate_blocker_count": gates,
            "unavailable_blocking_link_count": links, "project_overdue": project_overdue,
            "issue_count": overdue + blocked + gates + links + int(project_overdue),
        },
    }


def _response(rows: list[dict[str, Any]], total: int, query: str, status: str, limit: int, offset: int, query_count: int, started: float):
    statuses = Counter(str(row["status"]) for row in rows)
    return {
        "total": total, "limit": limit, "offset": offset, "query": query, "status": status, "projects": rows,
        "summary": {
            "visible_project_count": len(rows), "total_project_count": total,
            "task_count": sum(row["metrics"]["task_count"] for row in rows),
            "completed_task_count": sum(row["metrics"]["completed_task_count"] for row in rows),
            "blocked_task_count": sum(row["metrics"]["blocked_task_count"] for row in rows),
            "overdue_task_count": sum(row["attention"]["overdue_task_count"] for row in rows),
            "gate_blocker_count": sum(row["attention"]["gate_blocker_count"] for row in rows),
            "at_risk_project_count": sum(row["attention"]["health"] != "on_track" for row in rows),
            "status_counts": dict(statuses),
            "range_start": min((row["start"] for row in rows), default=None),
            "range_end": max((row["end"] for row in rows), default=None),
        },
        "diagnostics": {"strategy": "bounded_aggregate_v1", "query_count": query_count, "elapsed_ms": round((perf_counter() - started) * 1000, 2)},
    }


def _rows_by_project(result: Any) -> dict[str, Any]:
    return {str(row.project_id): row._mapping for row in result}


def _count_by_project(db: Session, model: Any, actor: Actor, project_ids: list[str]) -> dict[str, int]:
    rows = db.execute(select(model.project_id, func.count()).where(
        model.organization_id == actor.organization_id, model.project_id.in_(project_ids)
    ).group_by(model.project_id))
    return {str(project_id): int(count) for project_id, count in rows}


def _gate_blockers(db: Session, actor: Actor, project_ids: list[str]) -> dict[str, int]:
    blocked = and_(PlanningTaskRequirement.required.is_(True), or_(
        PlanningTaskRequirement.state.not_in({"satisfied", "waived"}),
        and_(PlanningTaskRequirement.state == "satisfied", PlanningTaskRequirement.target_link_id.is_not(None), or_(PlanningLink.id.is_(None), PlanningLink.resolution_status != "ready")),
    ))
    rows = db.execute(select(PlanningTaskRequirement.project_id, func.sum(case((blocked, 1), else_=0))).join(
        PlanningTask, PlanningTask.id == PlanningTaskRequirement.task_id
    ).outerjoin(PlanningLink, PlanningLink.id == PlanningTaskRequirement.target_link_id).where(
        PlanningTaskRequirement.organization_id == actor.organization_id,
        PlanningTaskRequirement.project_id.in_(project_ids), PlanningTask.status != "deleted",
    ).group_by(PlanningTaskRequirement.project_id))
    return {str(project_id): int(count or 0) for project_id, count in rows}


def _link_blockers(db: Session, actor: Actor, project_ids: list[str]) -> dict[str, int]:
    rows = db.execute(select(PlanningLink.project_id, func.sum(case((and_(
        PlanningLink.blocking.is_(True), PlanningLink.resolution_status != "ready"
    ), 1), else_=0))).where(
        PlanningLink.organization_id == actor.organization_id, PlanningLink.project_id.in_(project_ids)
    ).group_by(PlanningLink.project_id))
    return {str(project_id): int(count or 0) for project_id, count in rows}


__all__ = ["planning_portfolio_read_model"]

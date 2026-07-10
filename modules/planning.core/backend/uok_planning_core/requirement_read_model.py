from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import PlanningTask, PlanningTaskRequirement
from uok.security import Actor


def planning_requirements_read_model(
    db: Session,
    actor: Actor,
    project_id: str,
    links: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    links_by_id = {str(link["id"]): link for link in links}
    rows = db.scalars(select(PlanningTaskRequirement).join(
        PlanningTask,
        PlanningTask.id == PlanningTaskRequirement.task_id,
    ).where(
        PlanningTaskRequirement.organization_id == actor.organization_id,
        PlanningTaskRequirement.project_id == project_id,
        PlanningTask.status != "deleted",
    ).order_by(PlanningTaskRequirement.task_id, PlanningTaskRequirement.created_at)).all()
    return [serialize_requirement(row, links_by_id.get(str(row.target_link_id))) for row in rows]


def serialize_requirement(row: PlanningTaskRequirement, link: dict[str, Any] | None = None) -> dict[str, Any]:
    link_state = link["resolution"]["status"] if link else ("unlinked" if not row.target_link_id else "missing")
    blocking = bool(row.required) and (
        row.state not in {"satisfied", "waived"}
        or (row.state == "satisfied" and row.target_link_id is not None and link_state != "ready")
    )
    return {
        "id": row.id,
        "project_id": row.project_id,
        "task_id": row.task_id,
        "requirement_type": row.requirement_type,
        "title": row.title,
        "state": row.state,
        "required": bool(row.required),
        "blocking": blocking,
        "target_link_id": row.target_link_id,
        "target_link_state": link_state,
        "due": row.due_at.date().isoformat() if row.due_at else None,
        "decision_reason": row.decision_reason,
        "decided_by_actor_id": row.decided_by_actor_id,
        "decided_at": _timestamp(row.decided_at),
        "created_at": _timestamp(row.created_at),
        "updated_at": _timestamp(row.updated_at),
    }


def readiness_read_model(requirements: list[dict[str, Any]]) -> tuple[dict[str, dict[str, Any]], dict[str, Any]]:
    by_task: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for requirement in requirements:
        by_task[str(requirement["task_id"])].append(requirement)
    task_readiness = {task_id: _readiness(rows) for task_id, rows in by_task.items()}
    project = _readiness(requirements)
    project["task_blocker_count"] = sum(1 for value in task_readiness.values() if not value["ready"])
    return task_readiness, project


def project_requirement_context(db: Session, actor: Actor, project_id: str, links: list[dict[str, Any]]):
    requirements = planning_requirements_read_model(db, actor, project_id, links)
    task_readiness, project_readiness = readiness_read_model(requirements)
    return requirements, task_readiness, project_readiness


def _readiness(rows: list[dict[str, Any]]) -> dict[str, Any]:
    required = [row for row in rows if row["required"]]
    blockers = [row for row in required if row["blocking"]]
    return {
        "ready": not blockers,
        "required_count": len(required),
        "blocking_count": len(blockers),
        "blocking_requirement_ids": [str(row["id"]) for row in blockers],
    }


def _timestamp(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None or value.utcoffset() is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


__all__ = ["planning_requirements_read_model", "project_requirement_context", "readiness_read_model", "serialize_requirement"]

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import PlanningTaskParticipant, PlanningTaskRequirement
from uok.security import Actor


def task_context_states(db: Session, actor: Actor, project_id: str) -> dict[str, tuple[tuple[object, ...], ...]]:
    values: dict[str, list[tuple[object, ...]]] = {}
    participants = db.scalars(select(PlanningTaskParticipant).where(
        PlanningTaskParticipant.organization_id == actor.organization_id, PlanningTaskParticipant.project_id == project_id,
    )).all()
    for row in participants:
        values.setdefault(row.task_id, []).append(("participant", row.id, row.party_id, row.role))
    requirements = db.scalars(select(PlanningTaskRequirement).where(
        PlanningTaskRequirement.organization_id == actor.organization_id, PlanningTaskRequirement.project_id == project_id,
    )).all()
    for row in requirements:
        values.setdefault(row.task_id, []).append(("requirement", row.id, row.state, row.required, row.target_link_id, row.decision_reason))
    return {task_id: tuple(sorted(rows)) for task_id, rows in values.items()}


__all__ = ["task_context_states"]

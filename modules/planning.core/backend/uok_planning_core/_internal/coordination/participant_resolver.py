from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok_planning_core._internal.coordination.link_resolver import resolve_target
from uok_planning_core._internal.persistence.models import PlanningTask, PlanningTaskParticipant
from uok.security import Actor

PARTICIPANT_ROLES = ("owner", "assignee", "approver", "consulted", "informed", "external_contact")


def planning_participant_role(value: Any) -> str:
    role = str(value or "").strip()
    if role not in PARTICIPANT_ROLES:
        raise ValueError(f"role must be {', '.join(PARTICIPANT_ROLES)}")
    return role


def serialize_participant(db: Session, actor: Actor, row: PlanningTaskParticipant) -> dict[str, Any]:
    resolution = resolve_target(db, actor, "party", row.party_id)
    denied = resolution.status == "denied"
    return {
        "id": row.id,
        "project_id": row.project_id,
        "task_id": row.task_id,
        "role": row.role,
        "source_module": row.source_module,
        "party": {
            "id": None if denied else row.party_id,
            "resolver": "contacts.party",
            "resolver_version": "1",
        },
        "resolution": resolution.as_dict(_timestamp(row.updated_at)),
        "created_at": _timestamp(row.created_at),
        "updated_at": _timestamp(row.updated_at),
    }


def planning_participants_read_model(db: Session, actor: Actor, project_id: str) -> list[dict[str, Any]]:
    rows = db.scalars(select(PlanningTaskParticipant).join(
        PlanningTask,
        PlanningTask.id == PlanningTaskParticipant.task_id,
    ).where(
        PlanningTaskParticipant.organization_id == actor.organization_id,
        PlanningTaskParticipant.project_id == project_id,
        PlanningTask.status != "deleted",
    ).order_by(PlanningTaskParticipant.task_id, PlanningTaskParticipant.role, PlanningTaskParticipant.created_at)).all()
    return [serialize_participant(db, actor, row) for row in rows]


def _timestamp(value: datetime) -> str:
    if value.tzinfo is None or value.utcoffset() is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


__all__ = [
    "PARTICIPANT_ROLES",
    "planning_participant_role",
    "planning_participants_read_model",
    "serialize_participant",
]

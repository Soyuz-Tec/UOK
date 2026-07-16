from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok_planning_core._internal.coordination.link_resolver import serialize_link
from uok_planning_core._internal.persistence.models import PlanningLink
from uok.security import Actor


def planning_links_read_model(db: Session, actor: Actor, project_id: str) -> list[dict[str, object]]:
    rows = db.scalars(select(PlanningLink).where(
        PlanningLink.organization_id == actor.organization_id,
        PlanningLink.project_id == project_id,
    ).order_by(PlanningLink.created_at, PlanningLink.id)).all()
    return [serialize_link(db, actor, row) for row in rows]


__all__ = ["planning_links_read_model"]

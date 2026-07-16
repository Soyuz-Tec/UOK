from __future__ import annotations

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from uok_planning_core._internal.persistence.models import (
    PlanningAssignment,
    PlanningLink,
    PlanningResource,
    PlanningResourceCalendar,
    PlanningTask,
    PlanningTaskParticipant,
    PlanningTaskRequirement,
)
from uok.security import Actor

TaskContextRows = dict[str, list[tuple[object, ...]]]


def task_context_states(db: Session, actor: Actor, project_id: str) -> dict[str, tuple[tuple[object, ...], ...]]:
    values: TaskContextRows = {}
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
    _add_assignment_context(db, actor, project_id, values)
    _add_link_context(db, actor, project_id, values)
    return {task_id: tuple(sorted(rows)) for task_id, rows in values.items()}


def _add_assignment_context(db: Session, actor: Actor, project_id: str, values: TaskContextRows) -> None:
    assignment_rows = db.execute(
        select(PlanningAssignment, PlanningResource, PlanningResourceCalendar)
        .join(PlanningTask, PlanningTask.id == PlanningAssignment.task_id)
        .join(PlanningResource, PlanningResource.id == PlanningAssignment.resource_id)
        .outerjoin(
            PlanningResourceCalendar,
            and_(
                PlanningResourceCalendar.organization_id == PlanningAssignment.organization_id,
                PlanningResourceCalendar.resource_id == PlanningAssignment.resource_id,
            ),
        )
        .where(
            PlanningAssignment.organization_id == actor.organization_id,
            PlanningTask.project_id == project_id,
        )
    ).all()
    for assignment, resource, calendar in assignment_rows:
        values.setdefault(assignment.task_id, []).append((
            "assignment",
            assignment.id,
            assignment.resource_id,
            int(assignment.allocation_percent),
            resource.resource_type,
            str(resource.capacity_value),
            resource.capacity_unit,
            resource.canonical_target_kind,
            resource.canonical_target_id,
            resource.effective_start,
            resource.effective_end,
            calendar.name if calendar else None,
            calendar.working_days_json if calendar else None,
            calendar.holidays_json if calendar else None,
            int(calendar.default_capacity_percent) if calendar else None,
            calendar.capacity_exceptions_json if calendar else None,
        ))


def _add_link_context(db: Session, actor: Actor, project_id: str, values: TaskContextRows) -> None:
    links = db.scalars(select(PlanningLink).where(
        PlanningLink.organization_id == actor.organization_id,
        PlanningLink.project_id == project_id,
        PlanningLink.task_id.is_not(None),
    )).all()
    for row in links:
        values.setdefault(str(row.task_id), []).append((
            "link",
            row.id,
            row.relationship,
            row.target_kind,
            row.target_id,
            row.resolver,
            row.resolver_version,
            bool(row.blocking),
        ))


__all__ = ["task_context_states"]

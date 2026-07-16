from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok_planning_core._internal.persistence.models import PlanningResource, PlanningResourceCalendar
from uok_planning_core._internal.portfolio_audit.planning_audit import add_planning_schedule_event, emit_planning_event
from uok_planning_core._internal.scheduling.read_model import schedule_read_model
from uok_planning_core._internal.resources.resource_calendar import resource_calendar_definition
from uok_planning_core._internal.scheduling.scheduler import project_or_error
from uok.kernel.security import Actor
from uok.util import dumps


def cmd_set_resource_calendar(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    project_id = _required_id(payload.get("project_id"), "project_id")
    resource_id = _required_id(payload.get("resource_id"), "resource_id")
    project = project_or_error(db, actor, project_id)
    resource = db.scalar(select(PlanningResource).where(
        PlanningResource.id == resource_id,
        PlanningResource.organization_id == actor.organization_id,
        PlanningResource.project_id == project.id,
    ))
    if resource is None:
        raise ValueError("resource_id not found in the project")
    definition = resource_calendar_definition(payload, resource.id)
    row = db.scalar(select(PlanningResourceCalendar).where(
        PlanningResourceCalendar.organization_id == actor.organization_id,
        PlanningResourceCalendar.resource_id == resource.id,
    ))
    now = datetime.now(timezone.utc)
    if row is None:
        row = PlanningResourceCalendar(
            organization_id=actor.organization_id,
            project_id=project.id,
            resource_id=resource.id,
            created_at=now,
        )
        db.add(row)
    row.name = definition.name
    row.working_days_json = dumps(sorted(definition.working_days))
    row.holidays_json = dumps([day.isoformat() for day in sorted(definition.holidays)])
    row.default_capacity_percent = definition.default_capacity_percent
    row.capacity_exceptions_json = dumps([item.as_dict() for item in definition.exceptions])
    row.updated_at = now
    db.flush()
    evidence = {
        "project_id": project.id,
        "resource_id": resource.id,
        "default_capacity_percent": row.default_capacity_percent,
        "exception_count": len(definition.exceptions),
    }
    emit_planning_event(db, actor, command_id, "PlanningResourceCalendarUpdated", "PlanningResourceCalendar", row.id, evidence)
    add_planning_schedule_event(db, actor, command_id, project.id, "resource_calendar_updated", evidence)
    return schedule_read_model(db, actor, project)


def _required_id(value: Any, field: str) -> str:
    text = str(value or "").strip()
    if not text or len(text) > 36:
        raise ValueError(f"{field} is required and must be 36 characters or fewer")
    return text


__all__ = ["cmd_set_resource_calendar"]

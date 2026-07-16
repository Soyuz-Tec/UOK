from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from uok_planning_core._internal.persistence.models import PlanningScheduleEvent
from uok.module_events import emit_module_event
from uok.security import Actor
from uok.util import dumps


def emit_planning_event(
    db: Session,
    actor: Actor,
    command_id: str,
    event_type: str,
    object_type: str,
    object_id: str,
    payload: dict[str, Any],
) -> None:
    emit_module_event(db, actor, event_type, object_type, object_id, correlated_payload(command_id, payload))


def add_planning_schedule_event(
    db: Session,
    actor: Actor,
    command_id: str,
    project_id: str,
    event_type: str,
    payload: dict[str, Any],
) -> None:
    db.add(PlanningScheduleEvent(
        organization_id=actor.organization_id,
        project_id=project_id,
        event_type=event_type,
        payload_json=dumps(correlated_payload(command_id, payload)),
    ))


def correlated_payload(command_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    return {**payload, "correlation_id": command_id}


__all__ = ["add_planning_schedule_event", "correlated_payload", "emit_planning_event"]

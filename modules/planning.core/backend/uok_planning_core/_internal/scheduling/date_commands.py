from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from uok_planning_core._internal.scheduling.advanced_commands import clean_text
from uok_planning_core._internal.scheduling.date_semantics import apply_task_date_update
from uok_planning_core._internal.portfolio_audit.planning_audit import add_planning_schedule_event, emit_planning_event
from uok_planning_core._internal.scheduling.read_model import schedule_read_model, serialize_task
from uok_planning_core._internal.scheduling.scheduler import project_or_error, task_or_error
from uok.security import Actor


def cmd_update_planning_task_dates(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    task = task_or_error(db, actor, clean_text(payload.get("task_id"), "task_id", 36))
    project = project_or_error(db, actor, task.project_id)
    changed, reason = apply_task_date_update(task, project, payload, command_id)
    if not changed:
        raise ValueError("supplied execution dates do not change the task")
    event_payload = {
        "project_id": project.id,
        "task_id": task.id,
        "changed_fields": changed,
        "reason": reason,
        "timezone": project.timezone_name,
    }
    emit_planning_event(db, actor, command_id, "PlanningTaskDatesUpdated", "PlanningTask", task.id, event_payload)
    add_planning_schedule_event(db, actor, command_id, project.id, "task_dates_updated", event_payload)
    return {
        "task": serialize_task(task, project_timezone=project.timezone_name),
        "validation": schedule_read_model(db, actor, project)["validation"],
    }


__all__ = ["cmd_update_planning_task_dates"]

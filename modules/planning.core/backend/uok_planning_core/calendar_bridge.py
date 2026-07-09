from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from .models import PlanningProject, PlanningTask
from uok.module_ops import ensure_module_operational
from uok.security import Actor, require_permission


def calendar_availability_read_model(db: Session, actor: Actor, project: PlanningProject) -> dict[str, Any]:
    start = _stored_utc(project.start_at)
    end = _stored_utc(project.end_at) + timedelta(days=1)
    base = {
        "source_module": "calendar.core",
        "scope": "organization",
        "status": "unavailable",
        "from": start.isoformat(),
        "to": end.isoformat(),
        "busy": [],
        "events": [],
    }
    try:
        require_permission(actor, "calendar.freebusy.read")
        ensure_module_operational(db, actor.organization_id, "calendar.core")
        from uok_calendar_core.facade import freebusy_rows, occurrence_rows
    except (ImportError, PermissionError, ValueError) as exc:
        return {**base, "reason": str(exc)}
    busy = freebusy_rows(db, actor, start, end)
    events = occurrence_rows(db, actor, start, end)
    return {
        **base,
        "status": "ready",
        "busy": busy,
        "events": events[:200],
    }


def availability_warnings(tasks: list[PlanningTask], availability: dict[str, Any]) -> list[str]:
    if availability.get("status") != "ready":
        reason = availability.get("reason")
        return [f"Calendar availability unavailable: {reason}"] if reason else []
    warnings: list[str] = []
    busy_rows = availability.get("busy", [])
    for task in tasks:
        if task.task_type == "summary":
            continue
        for row in busy_rows:
            if _overlaps_task(task, str(row.get("start", "")), str(row.get("end", ""))):
                title = str(row.get("title") or "busy calendar event")
                warnings.append(f"Calendar busy time overlaps {task.title}: {title}")
                break
    return warnings


def _overlaps_task(task: PlanningTask, start_value: str, end_value: str) -> bool:
    try:
        busy_start = _stored_utc(datetime.fromisoformat(start_value.replace("Z", "+00:00"))).date()
        busy_end = (_stored_utc(datetime.fromisoformat(end_value.replace("Z", "+00:00"))) - timedelta(microseconds=1)).date()
    except ValueError:
        return False
    return busy_start <= task.end_at.date() and busy_end >= task.start_at.date()


def _stored_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from uok_planning_core._internal.coordination.link_resolver import resolve_target
from uok_planning_core._internal.persistence.models import PlanningAssignment, PlanningProject, PlanningResource, PlanningTask
from uok.kernel.module_runtime import ensure_module_operational
from uok.security import Actor, require_permission


def calendar_availability_read_model(
    db: Session,
    actor: Actor,
    project: PlanningProject,
    tasks: list[PlanningTask],
    resources: list[PlanningResource],
    assignments: list[PlanningAssignment],
    participants: list[dict[str, Any]],
) -> dict[str, Any]:
    start = _stored_utc(project.start_at)
    finish_candidates = [
        _stored_utc(project.end_at),
        _stored_utc(project.target_finish_at),
        _stored_utc(project.calculated_finish_at),
    ]
    finish_candidates.extend(_stored_utc(task.end_at) for task in tasks if task.status != "deleted")
    end = max(finish_candidates) + timedelta(days=1)
    base = {
        "source_module": "calendar.core",
        "scope": "task_parties",
        "status": "unavailable",
        "from": start.isoformat(),
        "to": end.isoformat(),
        "busy": [],
        "events": [],
    }
    try:
        require_permission(actor, "calendar.freebusy.read")
        ensure_module_operational(db, actor.organization_id, "calendar.core")
        from uok_calendar_core.public_api import freebusy_rows_for_participants, occurrence_rows_for_participants
    except (ImportError, PermissionError, ValueError) as exc:
        return {**base, "reason": str(exc)}
    task_parties = _task_party_ids(db, actor, resources, assignments, participants)
    party_ids = set().union(*task_parties.values()) if task_parties else set()
    try:
        busy = freebusy_rows_for_participants(db, actor, start, end, party_ids)
        events = occurrence_rows_for_participants(db, actor, start, end, party_ids)
    except ValueError as exc:
        return {**base, "reason": str(exc)}
    return {
        **base,
        "status": "ready",
        "busy": [_with_task_ids(row, task_parties) for row in busy],
        "events": [_with_task_ids(row, task_parties) for row in events[:200]],
        "correlation": {"party_count": len(party_ids), "task_count": len(task_parties)},
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
            if task.id in row.get("task_ids", []) and _overlaps_task(task, str(row.get("start", "")), str(row.get("end", ""))):
                title = str(row.get("title") or "busy calendar event")
                warnings.append(f"Calendar busy time overlaps {task.title}: {title}")
                break
    return warnings


def _task_party_ids(
    db: Session,
    actor: Actor,
    resources: list[PlanningResource],
    assignments: list[PlanningAssignment],
    participants: list[dict[str, Any]],
) -> dict[str, set[str]]:
    task_parties: dict[str, set[str]] = {}
    ready_resource_parties = {
        resource.id: str(resource.canonical_target_id)
        for resource in resources
        if resource.canonical_target_kind == "party"
        and resource.canonical_target_id
        and resolve_target(db, actor, "party", str(resource.canonical_target_id)).status == "ready"
    }
    for assignment in assignments:
        party_id = ready_resource_parties.get(assignment.resource_id)
        if party_id:
            task_parties.setdefault(assignment.task_id, set()).add(party_id)
    for participant in participants:
        party_id = participant.get("party", {}).get("id")
        if party_id and participant.get("resolution", {}).get("status") == "ready":
            task_parties.setdefault(str(participant["task_id"]), set()).add(str(party_id))
    return task_parties


def _with_task_ids(row: dict[str, Any], task_parties: dict[str, set[str]]) -> dict[str, Any]:
    participant_ids = {str(value) for value in row.get("participant_ids", [])}
    return {
        **row,
        "task_ids": sorted(task_id for task_id, parties in task_parties.items() if parties & participant_ids),
    }


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

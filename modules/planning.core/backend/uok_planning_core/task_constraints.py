from __future__ import annotations

from datetime import date
from typing import Any

from .models import PlanningTask
from .schedule_math import CalendarSpec, at_utc, end_for_start, start_for_finish
from uok.util import dumps, loads

CONSTRAINT_TYPES = {
    "must_start_on",
    "must_finish_on",
    "start_no_earlier_than",
    "start_no_later_than",
    "finish_no_earlier_than",
    "finish_no_later_than",
}
SCHEDULING_MODES = {"auto", "manual"}


def serialize_task_constraint(task: PlanningTask) -> dict[str, str | None]:
    constraint_type, constraint_date = task_constraint(task)
    return {
        "constraint_type": constraint_type,
        "constraint_date": constraint_date.isoformat() if constraint_date else None,
        "scheduling_mode": scheduling_mode(task),
    }


def set_task_planning_attrs(task: PlanningTask, payload: dict[str, Any]) -> None:
    if "scheduling_mode" in payload:
        set_scheduling_mode(task, payload.get("scheduling_mode"))
    if "constraint_type" in payload or "constraint_date" in payload:
        set_task_constraint(task, payload.get("constraint_type"), payload.get("constraint_date"))


def scheduling_mode(task: PlanningTask) -> str:
    attrs = loads(task.attrs_json, {})
    mode = str(attrs.get("scheduling_mode") or "auto").strip()
    return mode if mode in SCHEDULING_MODES else "auto"


def is_auto_scheduled(task: PlanningTask) -> bool:
    return scheduling_mode(task) == "auto"


def set_scheduling_mode(task: PlanningTask, value: Any) -> None:
    mode = str(value or "auto").strip()
    if mode not in SCHEDULING_MODES:
        raise ValueError("scheduling_mode must be auto or manual")
    attrs = loads(task.attrs_json, {})
    if mode == "auto":
        attrs.pop("scheduling_mode", None)
    else:
        attrs["scheduling_mode"] = mode
    task.attrs_json = dumps(attrs)


def set_task_constraint(task: PlanningTask, constraint_type: Any, constraint_date: Any) -> None:
    attrs = loads(task.attrs_json, {})
    ctype = str(constraint_type or "").strip()
    if not ctype or ctype == "none":
        attrs.pop("constraint_type", None)
        attrs.pop("constraint_date", None)
        task.attrs_json = dumps(attrs)
        return
    if ctype not in CONSTRAINT_TYPES:
        raise ValueError("constraint_type is not supported")
    cdate = _constraint_date(constraint_date)
    attrs["constraint_type"] = ctype
    attrs["constraint_date"] = cdate.isoformat()
    task.attrs_json = dumps(attrs)


def enforce_task_constraints(tasks: list[PlanningTask], calendar: CalendarSpec) -> set[str]:
    changed: set[str] = set()
    for task in tasks:
        target = _target_start(task, calendar)
        if target is None:
            continue
        end = target if task.task_type == "milestone" else end_for_start(target, max(1, task.duration_days), calendar)
        if task.start_at.date() != target or task.end_at.date() != end:
            task.start_at = at_utc(target)
            task.end_at = at_utc(end)
            changed.add(task.id)
    return changed


def constraint_violations(tasks: list[PlanningTask]) -> list[str]:
    violations: list[str] = []
    for task in tasks:
        ctype, cdate = task_constraint(task)
        if not ctype or not cdate:
            continue
        if task.task_type == "summary":
            violations.append(f"{task.title} has a constraint on a summary task")
            continue
        start = task.start_at.date()
        finish = task.end_at.date()
        if ctype == "must_start_on" and start != cdate:
            violations.append(f"{task.title} must start on {cdate.isoformat()}")
        elif ctype == "must_finish_on" and finish != cdate:
            violations.append(f"{task.title} must finish on {cdate.isoformat()}")
        elif ctype == "start_no_earlier_than" and start < cdate:
            violations.append(f"{task.title} must start no earlier than {cdate.isoformat()}")
        elif ctype == "start_no_later_than" and start > cdate:
            violations.append(f"{task.title} must start no later than {cdate.isoformat()}")
        elif ctype == "finish_no_earlier_than" and finish < cdate:
            violations.append(f"{task.title} must finish no earlier than {cdate.isoformat()}")
        elif ctype == "finish_no_later_than" and finish > cdate:
            violations.append(f"{task.title} must finish no later than {cdate.isoformat()}")
    return violations


def task_constraint(task: PlanningTask) -> tuple[str, date | None]:
    attrs = loads(task.attrs_json, {})
    ctype = str(attrs.get("constraint_type") or "")
    if ctype not in CONSTRAINT_TYPES:
        return "", None
    return ctype, _constraint_date(attrs.get("constraint_date"))


def _target_start(task: PlanningTask, calendar: CalendarSpec) -> date | None:
    if task.task_type == "summary":
        return None
    ctype, cdate = task_constraint(task)
    if not ctype or not cdate:
        return None
    start = task.start_at.date()
    finish = task.end_at.date()
    duration = max(1, task.duration_days)
    if ctype == "must_start_on" or (ctype == "start_no_earlier_than" and start < cdate) or (ctype == "start_no_later_than" and start > cdate):
        return cdate
    if ctype == "must_finish_on":
        return start_for_finish(cdate, duration, calendar)
    if ctype == "finish_no_earlier_than" and finish < cdate:
        return start_for_finish(cdate, duration, calendar)
    if ctype == "finish_no_later_than" and finish > cdate:
        return start_for_finish(cdate, duration, calendar)
    return None


def _constraint_date(value: Any) -> date:
    text = str(value or "").strip()
    if len(text) > 10:
        text = text[:10]
    if not text:
        raise ValueError("constraint_date is required")
    try:
        return date.fromisoformat(text)
    except ValueError as exc:
        raise ValueError("constraint_date must be an ISO date") from exc

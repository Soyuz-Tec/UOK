from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timezone
import json

from uok_planning_core.schedule_math import CalendarSpec, default_calendar, end_for_start


@dataclass
class Task:
    id: str
    title: str
    task_type: str
    duration_days: int
    start_at: datetime
    end_at: datetime
    attrs_json: str = "{}"
    parent_task_id: str | None = None


@dataclass(frozen=True)
class Dependency:
    predecessor_task_id: str
    successor_task_id: str
    dependency_type: str = "finish_to_start"
    lag_days: int = 0


def task(
    task_id: str,
    duration: int,
    *,
    start: date = date(2026, 8, 3),
    task_type: str = "task",
    scheduling_mode: str = "auto",
    constraint_type: str | None = None,
    constraint_date: date | None = None,
    calendar: CalendarSpec | None = None,
) -> Task:
    calendar = calendar or default_calendar()
    actual_duration = 0 if task_type == "milestone" else duration
    finish = start if actual_duration == 0 else end_for_start(start, actual_duration, calendar)
    attrs: dict[str, str] = {}
    if scheduling_mode != "auto":
        attrs["scheduling_mode"] = scheduling_mode
    if constraint_type:
        attrs["constraint_type"] = constraint_type
        attrs["constraint_date"] = (constraint_date or start).isoformat()
    return Task(
        task_id,
        task_id,
        task_type,
        actual_duration,
        _at_utc(start),
        _at_utc(finish),
        json.dumps(attrs, sort_keys=True, separators=(",", ":")),
    )


def _at_utc(value: date) -> datetime:
    return datetime.combine(value, time.min, tzinfo=timezone.utc)

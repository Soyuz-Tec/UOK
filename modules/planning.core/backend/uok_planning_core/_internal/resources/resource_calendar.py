from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok_planning_core._internal.persistence.models import PlanningResource, PlanningResourceCalendar
from uok.security import Actor
from uok.util import loads


@dataclass(frozen=True)
class CapacityException:
    start: date
    end: date
    capacity_percent: int
    reason: str

    def as_dict(self) -> dict[str, object]:
        return {
            "start": self.start.isoformat(),
            "end": self.end.isoformat(),
            "capacity_percent": self.capacity_percent,
            "reason": self.reason,
        }


@dataclass(frozen=True)
class ResourceCalendarSpec:
    resource_id: str
    name: str
    working_days: frozenset[int]
    holidays: frozenset[date]
    default_capacity_percent: int
    exceptions: tuple[CapacityException, ...]

    def as_dict(self) -> dict[str, object]:
        return {
            "name": self.name,
            "working_days": sorted(self.working_days),
            "holidays": [day.isoformat() for day in sorted(self.holidays)],
            "default_capacity_percent": self.default_capacity_percent,
            "capacity_exceptions": [item.as_dict() for item in self.exceptions],
        }


def resource_calendar_definition(payload: dict[str, Any], resource_id: str = "") -> ResourceCalendarSpec:
    name = str(payload.get("name") or "Resource capacity").strip()
    if not name or len(name) > 120:
        raise ValueError("name must be between 1 and 120 characters")
    working_days = _working_days(payload.get("working_days", [1, 2, 3, 4, 5]))
    holidays = frozenset(_calendar_date(item, "holiday") for item in payload.get("holidays", []))
    default_capacity = _capacity_percent(payload.get("default_capacity_percent", 100), "default_capacity_percent")
    exceptions = _capacity_exceptions(payload.get("capacity_exceptions", []))
    return ResourceCalendarSpec(resource_id, name, working_days, holidays, default_capacity, exceptions)


def resource_calendar_specs(db: Session, actor: Actor, project_id: str) -> dict[str, ResourceCalendarSpec]:
    rows = db.scalars(select(PlanningResourceCalendar).where(
        PlanningResourceCalendar.organization_id == actor.organization_id,
        PlanningResourceCalendar.project_id == project_id,
    )).all()
    return {row.resource_id: _spec_from_row(row) for row in rows}


def resource_capacity_percent(resource: PlanningResource, spec: ResourceCalendarSpec | None, day: date) -> int:
    if resource.effective_start is not None and day < resource.effective_start:
        return 0
    if resource.effective_end is not None and day > resource.effective_end:
        return 0
    if spec is None:
        return 100
    if day.isoweekday() not in spec.working_days or day in spec.holidays:
        return 0
    for item in spec.exceptions:
        if item.start <= day <= item.end:
            return item.capacity_percent
    return spec.default_capacity_percent


def _spec_from_row(row: PlanningResourceCalendar) -> ResourceCalendarSpec:
    return ResourceCalendarSpec(
        row.resource_id,
        row.name,
        frozenset(int(item) for item in loads(row.working_days_json, [])),
        frozenset(date.fromisoformat(str(item)) for item in loads(row.holidays_json, [])),
        int(row.default_capacity_percent),
        tuple(
            CapacityException(
                date.fromisoformat(str(item["start"])),
                date.fromisoformat(str(item["end"])),
                int(item["capacity_percent"]),
                str(item.get("reason") or ""),
            )
            for item in loads(row.capacity_exceptions_json, [])
        ),
    )


def _working_days(value: Any) -> frozenset[int]:
    try:
        days = frozenset(int(item) for item in value)
    except (TypeError, ValueError) as exc:
        raise ValueError("working_days must contain ISO weekday numbers") from exc
    if not days or any(item < 1 or item > 7 for item in days):
        raise ValueError("working_days must contain ISO weekday numbers from 1 to 7")
    return days


def _capacity_exceptions(value: Any) -> tuple[CapacityException, ...]:
    if not isinstance(value, list) or len(value) > 100:
        raise ValueError("capacity_exceptions must contain at most 100 rows")
    values: list[CapacityException] = []
    for index, raw in enumerate(value, start=1):
        if not isinstance(raw, dict):
            raise ValueError(f"capacity_exceptions[{index}] must be an object")
        start = _calendar_date(raw.get("start"), f"capacity_exceptions[{index}].start")
        end = _calendar_date(raw.get("end"), f"capacity_exceptions[{index}].end")
        if end < start or (end - start).days > 366:
            raise ValueError(f"capacity_exceptions[{index}] must be ordered and 366 days or fewer")
        reason = str(raw.get("reason") or "").strip()
        if len(reason) > 180:
            raise ValueError(f"capacity_exceptions[{index}].reason must be 180 characters or fewer")
        values.append(CapacityException(start, end, _capacity_percent(raw.get("capacity_percent"), f"capacity_exceptions[{index}].capacity_percent"), reason))
    values.sort(key=lambda item: (item.start, item.end))
    if any(current.start <= previous.end for previous, current in zip(values, values[1:])):
        raise ValueError("capacity_exceptions cannot overlap")
    return tuple(values)


def _calendar_date(value: Any, field: str) -> date:
    try:
        return date.fromisoformat(str(value))
    except ValueError as exc:
        raise ValueError(f"{field} must be an ISO calendar date") from exc


def _capacity_percent(value: Any, field: str) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field} must be an integer") from exc
    if parsed < 0 or parsed > 300:
        raise ValueError(f"{field} must be between 0 and 300")
    return parsed


__all__ = ["CapacityException", "ResourceCalendarSpec", "resource_calendar_definition", "resource_calendar_specs", "resource_capacity_percent"]

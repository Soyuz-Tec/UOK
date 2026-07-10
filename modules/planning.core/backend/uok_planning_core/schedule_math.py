from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone


@dataclass(frozen=True)
class CalendarSpec:
    working_days: frozenset[int]
    holidays: frozenset[date]

    def is_working_day(self, value: date) -> bool:
        return value.isoweekday() in self.working_days and value not in self.holidays


def default_calendar() -> CalendarSpec:
    return CalendarSpec(frozenset({1, 2, 3, 4, 5}), frozenset())


def working_duration(start: date, end: date, calendar: CalendarSpec) -> int:
    if end < start:
        return 0
    current = start
    count = 0
    while current <= end:
        if calendar.is_working_day(current):
            count += 1
        current += timedelta(days=1)
    return count


def shift_working(value: date, offset: int, calendar: CalendarSpec) -> date:
    if offset == 0:
        return value
    step = 1 if offset > 0 else -1
    remaining = abs(offset)
    current = value
    while remaining:
        current += timedelta(days=step)
        if calendar.is_working_day(current):
            remaining -= 1
    return current


def next_working_day(value: date, calendar: CalendarSpec) -> date:
    current = value
    while not calendar.is_working_day(current):
        current += timedelta(days=1)
    return current


def previous_working_day(value: date, calendar: CalendarSpec) -> date:
    current = value
    while not calendar.is_working_day(current):
        current -= timedelta(days=1)
    return current


def end_for_start(start: date, duration: int, calendar: CalendarSpec) -> date:
    if duration <= 0:
        return start
    current = next_working_day(start, calendar)
    return shift_working(current, duration - 1, calendar)


def start_for_finish(finish: date, duration: int, calendar: CalendarSpec) -> date:
    if duration <= 0:
        return finish
    current = finish
    while not calendar.is_working_day(current):
        current -= timedelta(days=1)
    return shift_working(current, -(duration - 1), calendar)


def working_distance(start: date, end: date, calendar: CalendarSpec) -> int:
    if end <= start:
        return 0
    return working_duration(shift_working(start, 1, calendar), end, calendar)


def signed_working_distance(start: date, end: date, calendar: CalendarSpec) -> int:
    if end >= start:
        return working_distance(start, end, calendar)
    return -working_distance(end, start, calendar)


def at_utc(value: date) -> datetime:
    return datetime.combine(value, time.min, tzinfo=timezone.utc)

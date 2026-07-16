from __future__ import annotations

from datetime import date
from typing import Any


def calendar_holidays(raw: Any) -> list[str]:
    payload = _payload(raw)
    if isinstance(payload, dict):
        return [str(item) for item in payload.get("holidays", [])]
    return [str(item) for item in payload]


def calendar_ignored_periods(raw: Any) -> list[dict[str, str]]:
    payload = _payload(raw)
    if not isinstance(payload, dict):
        return []
    periods: list[dict[str, str]] = []
    for item in payload.get("ignored_periods", []):
        if isinstance(item, dict) and item.get("start") and item.get("end"):
            periods.append({"start": str(item["start"]), "end": str(item["end"])})
    return periods


def calendar_ignored_dates(raw: Any) -> set[date]:
    values: set[date] = set()
    for period in calendar_ignored_periods(raw):
        current = date.fromisoformat(period["start"])
        end = date.fromisoformat(period["end"])
        while current <= end:
            values.add(current)
            current = date.fromordinal(current.toordinal() + 1)
    return values


def _payload(raw: Any) -> Any:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, list):
        return raw
    return []

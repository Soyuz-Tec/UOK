from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

RESOURCE_UNITS_BY_TYPE: dict[str, tuple[str, ...]] = {
    "human": ("fte", "hours_per_day", "percent"),
    "team": ("fte", "people", "hours_per_day", "percent"),
    "vehicle": ("units", "hours_per_day", "percent"),
    "equipment": ("units", "hours_per_day", "percent"),
    "material": ("units", "kg", "tonnes", "liters"),
    "budget": ("currency",),
    "time_window": ("hours_per_day", "percent"),
    "document": ("units", "hours_per_day", "percent"),
    "location": ("units", "hours_per_day", "percent"),
    "asset": ("units", "hours_per_day", "percent"),
    "custom": ("units", "hours_per_day", "percent"),
}
CANONICAL_KINDS_BY_TYPE: dict[str, tuple[str, ...]] = {
    "human": ("party",),
    "team": ("party",),
    "vehicle": ("asset",),
    "equipment": ("asset",),
    "material": ("asset",),
    "budget": ("agreement",),
    "time_window": ("calendar_event",),
    "document": ("document",),
    "location": ("location",),
    "asset": ("asset",),
    "custom": ("party", "document", "location", "asset", "agreement", "calendar_event"),
}


@dataclass(frozen=True)
class ResourceDefinition:
    resource_type: str
    capacity_value: Decimal
    capacity_unit: str
    canonical_target_kind: str | None
    canonical_target_id: str | None
    effective_start: date | None
    effective_end: date | None


def resource_definition(payload: dict[str, Any]) -> ResourceDefinition:
    resource_type = str(payload.get("resource_type") or "human").strip()
    if resource_type not in RESOURCE_UNITS_BY_TYPE:
        raise ValueError(f"resource_type must be one of {', '.join(RESOURCE_UNITS_BY_TYPE)}")
    capacity_value = _capacity(payload.get("capacity_value", 1))
    capacity_unit = str(payload.get("capacity_unit") or RESOURCE_UNITS_BY_TYPE[resource_type][0]).strip()
    if capacity_unit not in RESOURCE_UNITS_BY_TYPE[resource_type]:
        allowed = ", ".join(RESOURCE_UNITS_BY_TYPE[resource_type])
        raise ValueError(f"capacity_unit for {resource_type} must be one of {allowed}")
    canonical_kind = _optional_text(payload.get("canonical_target_kind"), "canonical_target_kind", 40)
    canonical_id = _optional_text(payload.get("canonical_target_id"), "canonical_target_id", 180)
    if (canonical_kind is None) != (canonical_id is None):
        raise ValueError("canonical_target_kind and canonical_target_id must be provided together")
    if canonical_kind is not None and canonical_kind not in CANONICAL_KINDS_BY_TYPE[resource_type]:
        allowed = ", ".join(CANONICAL_KINDS_BY_TYPE[resource_type])
        raise ValueError(f"canonical_target_kind for {resource_type} must be one of {allowed}")
    effective_start = _optional_date(payload.get("effective_start"), "effective_start")
    effective_end = _optional_date(payload.get("effective_end"), "effective_end")
    if effective_start is not None and effective_end is not None and effective_end < effective_start:
        raise ValueError("effective_end must be on or after effective_start")
    return ResourceDefinition(
        resource_type,
        capacity_value,
        capacity_unit,
        canonical_kind,
        canonical_id,
        effective_start,
        effective_end,
    )


def _capacity(value: Any) -> Decimal:
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError("capacity_value must be a decimal number") from exc
    if not parsed.is_finite() or parsed <= 0 or parsed > Decimal("99999999999.999"):
        raise ValueError("capacity_value must be greater than 0 and no more than 99999999999.999")
    if parsed.as_tuple().exponent < -3:
        raise ValueError("capacity_value must have no more than three decimal places")
    return parsed


def _optional_text(value: Any, field: str, limit: int) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        raise ValueError(f"{field} cannot be empty")
    if len(text) > limit:
        raise ValueError(f"{field} must be {limit} characters or fewer")
    return text


def _optional_date(value: Any, field: str) -> date | None:
    if value is None:
        return None
    try:
        return date.fromisoformat(str(value))
    except ValueError as exc:
        raise ValueError(f"{field} must be an ISO calendar date") from exc


__all__ = ["CANONICAL_KINDS_BY_TYPE", "RESOURCE_UNITS_BY_TYPE", "ResourceDefinition", "resource_definition"]

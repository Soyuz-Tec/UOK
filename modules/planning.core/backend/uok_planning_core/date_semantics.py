from __future__ import annotations

import re
from datetime import date, datetime, time, timezone
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .models import PlanningProject, PlanningTask, utcnow
from uok.command_context import CommandDomainError

EXECUTION_DATE_FIELDS = {
    "forecast_start": "forecast_start_at",
    "forecast_end": "forecast_end_at",
    "actual_start": "actual_start_at",
    "actual_end": "actual_end_at",
    "deadline": "deadline_at",
}
ISO_DATE_PATTERN = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")


def planning_timezone(value: Any) -> str:
    name = str(value or "UTC").strip()
    if not name or len(name) > 80:
        raise ValueError("timezone must be an IANA timezone name of 1 to 80 characters")
    try:
        ZoneInfo(name)
    except ZoneInfoNotFoundError as exc:
        raise ValueError("timezone must be a recognized IANA timezone name") from exc
    return name


def parse_execution_date(value: Any, field: str, timezone_name: str) -> datetime | None:
    if value is None or str(value).strip() == "":
        return None
    text = str(value).strip()
    if not ISO_DATE_PATTERN.fullmatch(text):
        raise ValueError(f"{field} must be an ISO calendar date in YYYY-MM-DD form")
    try:
        local_date = date.fromisoformat(text)
    except ValueError as exc:
        raise ValueError(f"{field} must be an ISO calendar date in YYYY-MM-DD form") from exc
    local_midnight = datetime.combine(local_date, time.min, tzinfo=ZoneInfo(planning_timezone(timezone_name)))
    return local_midnight.astimezone(timezone.utc)


def execution_date(value: datetime | None, timezone_name: str) -> date | None:
    if value is None:
        return None
    aware = value if value.tzinfo and value.utcoffset() is not None else value.replace(tzinfo=timezone.utc)
    return aware.astimezone(ZoneInfo(planning_timezone(timezone_name))).date()


def apply_task_date_update(
    task: PlanningTask,
    project: PlanningProject,
    payload: dict[str, Any],
    command_id: str,
) -> tuple[list[str], str]:
    supplied = [field for field in EXECUTION_DATE_FIELDS if field in payload]
    if not supplied:
        raise _date_error(project, task, command_id, "planning_task_dates_empty", "At least one execution date field is required.", "dates", "Supply a forecast, actual, or deadline date to change.")
    values = {field: getattr(task, attribute) for field, attribute in EXECUTION_DATE_FIELDS.items()}
    for field in supplied:
        values[field] = parse_execution_date(payload.get(field), field, project.timezone_name)
    _validate_date_order(project, task, values, command_id)

    changed = [field for field in supplied if values[field] != getattr(task, EXECUTION_DATE_FIELDS[field])]
    reason = str(payload.get("reason") or "").strip()
    if any(field.startswith("actual_") for field in changed) and not reason:
        raise _date_error(project, task, command_id, "planning_actual_reason_required", "Changing actual dates requires a reason.", "reason", "Describe the observed fact or correction, then retry.")
    if len(reason) > 500:
        raise _date_error(project, task, command_id, "planning_actual_reason_invalid", "reason must be 500 characters or fewer.", "reason", "Shorten the reason and retry.")
    for field in changed:
        setattr(task, EXECUTION_DATE_FIELDS[field], values[field])
    if changed:
        task.updated_at = utcnow()
        project.updated_at = task.updated_at
    return changed, reason


def task_date_read_model(task: PlanningTask, timezone_name: str) -> dict[str, Any]:
    planned_start = task.start_at.date()
    planned_end = task.end_at.date()
    values = {
        field: execution_date(getattr(task, attribute), timezone_name)
        for field, attribute in EXECUTION_DATE_FIELDS.items()
    }
    return {
        "planned_start": planned_start.isoformat(),
        "planned_end": planned_end.isoformat(),
        **{field: value.isoformat() if value else None for field, value in values.items()},
        "forecast_start_variance_days": _variance(planned_start, values["forecast_start"]),
        "forecast_end_variance_days": _variance(planned_end, values["forecast_end"]),
        "actual_start_variance_days": _variance(planned_start, values["actual_start"]),
        "actual_end_variance_days": _variance(planned_end, values["actual_end"]),
        "deadline_variance_days": _variance(values["deadline"], planned_end),
    }


def date_semantics_read_model(project: PlanningProject) -> dict[str, Any]:
    return {
        "precision": "calendar_date",
        "project_timezone": project.timezone_name,
        "storage_timezone": "UTC",
        "planned": {"fields": ["start", "end"], "authority": "scheduler"},
        "forecast": {"fields": ["forecast_start", "forecast_end"], "authority": "planner"},
        "actual": {"fields": ["actual_start", "actual_end"], "authority": "explicit_fact_with_reason"},
        "deadline": {"fields": ["deadline"], "authority": "planner_commitment"},
        "subday_scales": "visual_only",
    }


def _validate_date_order(
    project: PlanningProject,
    task: PlanningTask,
    values: dict[str, datetime | None],
    command_id: str,
) -> None:
    if values["forecast_start"] and values["forecast_end"] and values["forecast_end"] < values["forecast_start"]:
        raise _date_error(project, task, command_id, "planning_forecast_order_invalid", "forecast_end must be on or after forecast_start.", "forecast_end", "Move forecast_end to the same or a later project calendar date.")
    if values["actual_end"] and not values["actual_start"]:
        raise _date_error(project, task, command_id, "planning_actual_start_required", "actual_start is required before actual_end can be recorded.", "actual_start", "Record the observed actual start before the actual finish.")
    if values["actual_start"] and values["actual_end"] and values["actual_end"] < values["actual_start"]:
        raise _date_error(project, task, command_id, "planning_actual_order_invalid", "actual_end must be on or after actual_start.", "actual_end", "Correct the observed actual dates and provide a reason.")


def _variance(reference: date | None, observed: date | None) -> int | None:
    if reference is None or observed is None:
        return None
    return (observed - reference).days


def _date_error(
    project: PlanningProject,
    task: PlanningTask,
    command_id: str,
    code: str,
    message: str,
    field: str,
    repair: str,
) -> CommandDomainError:
    return CommandDomainError(
        code=code,
        message=message,
        field=field,
        object_ids=[project.id, task.id],
        repair=repair,
        current_revision=int(project.revision),
        correlation_id=command_id,
    )


__all__ = [
    "EXECUTION_DATE_FIELDS",
    "apply_task_date_update",
    "date_semantics_read_model",
    "execution_date",
    "parse_execution_date",
    "planning_timezone",
    "task_date_read_model",
]

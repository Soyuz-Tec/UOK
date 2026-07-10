from __future__ import annotations

import re
from typing import Any

from uok.command_context import CommandDomainError


PLANNING_FIELDS = (
    "project_id",
    "task_id",
    "dependency_id",
    "resource_id",
    "parent_task_id",
    "predecessor_task_id",
    "successor_task_id",
    "title",
    "name",
    "start",
    "end",
    "progress",
    "status",
    "task_type",
    "dependency_type",
    "lag_days",
    "allocation_percent",
    "scheduling_mode",
    "constraint_type",
    "constraint_date",
)


def planning_domain_error(
    exc: ValueError,
    payload: dict[str, Any],
    command_id: str,
    current_revision: int | None,
) -> CommandDomainError:
    message = str(exc)
    field = _field_in_message(message)
    code = "planning_object_not_found" if "not found" in message.lower() else "planning_validation_failed"
    object_ids = [
        str(payload[key])
        for key in ("project_id", "task_id", "dependency_id", "resource_id")
        if payload.get(key)
    ]
    return CommandDomainError(
        code=code,
        message=message,
        field=field,
        object_ids=object_ids,
        repair="Correct the identified Planning input against the latest schedule, then retry the same user intent.",
        current_revision=current_revision,
        correlation_id=command_id,
    )


def _field_in_message(message: str) -> str | None:
    matches: list[tuple[int, int, str]] = []
    for priority, field in enumerate(PLANNING_FIELDS):
        pattern = re.escape(field).replace("_", "[_ ]")
        match = re.search(rf"\b{pattern}\b", message, re.IGNORECASE)
        if match:
            matches.append((match.start(), priority, field))
    return min(matches)[2] if matches else None


__all__ = ["planning_domain_error"]

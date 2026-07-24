from __future__ import annotations

from typing import Any

from uok.kernel.command_contracts import CommandDomainError

TASK_STATUSES = ("planned", "in_progress", "blocked", "complete", "deleted")
USER_TASK_STATUSES = TASK_STATUSES[:-1]
TASK_STATUS_DISPLAY_LABELS = {
    "planned": "Planned",
    "in_progress": "In progress",
    "blocked": "Blocked",
    "complete": "Complete",
}
TASK_STATUS_TRANSITIONS = {
    "planned": {"in_progress", "blocked", "complete"},
    "in_progress": {"planned", "blocked", "complete"},
    "blocked": {"planned", "in_progress", "complete"},
    "complete": {"planned", "in_progress"},
    "deleted": set(),
}


def task_flow_read_model() -> dict[str, Any]:
    return {
        "schema_version": 1,
        "statuses": [
            {
                "status": status,
                "display_label": TASK_STATUS_DISPLAY_LABELS[status],
                "allowed_transitions": [
                    target
                    for target in USER_TASK_STATUSES
                    if target in TASK_STATUS_TRANSITIONS[status]
                ],
            }
            for status in USER_TASK_STATUSES
        ],
    }


def planning_task_status(value: Any, *, allow_deleted: bool = False) -> str:
    status = str(value or "planned").strip()
    accepted = TASK_STATUSES if allow_deleted else USER_TASK_STATUSES
    if status not in accepted:
        raise ValueError(f"status must be {', '.join(accepted)}")
    return status


def assert_task_status_transition(
    current: str,
    target: str,
    *,
    task_id: str,
    current_revision: int,
    command_id: str,
) -> None:
    if target == current:
        return
    allowed = TASK_STATUS_TRANSITIONS.get(current, set())
    if target in allowed:
        return
    choices = ", ".join(sorted(allowed)) or "none"
    raise CommandDomainError(
        code="planning_status_transition_invalid",
        message=f"status cannot transition from {current} to {target}",
        field="status",
        object_ids=[task_id],
        repair=f"Choose one of the allowed next states: {choices}.",
        current_revision=int(current_revision),
        correlation_id=command_id,
    )


__all__ = [
    "TASK_STATUSES",
    "TASK_STATUS_DISPLAY_LABELS",
    "TASK_STATUS_TRANSITIONS",
    "USER_TASK_STATUSES",
    "assert_task_status_transition",
    "planning_task_status",
    "task_flow_read_model",
]

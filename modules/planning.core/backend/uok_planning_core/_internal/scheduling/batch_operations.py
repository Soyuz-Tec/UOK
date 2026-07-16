from __future__ import annotations

from typing import Any, Callable

from sqlalchemy.orm import Session

from uok_planning_core._internal.scheduling.batch_context_operations import assign_resource, create_link, remove_link, transition_gate, unassign_resource
from uok_planning_core._internal.scheduling.batch_operation_types import AppliedBatchOperation
from uok_planning_core._internal.scheduling.batch_schedule_operations import create_dependency, remove_dependency, set_calendar, update_dependency, update_task
from uok_planning_core._internal.persistence.models import PlanningProject
from uok.security import Actor, has_permission

BatchOperationHandler = Callable[[Session, Actor, PlanningProject, dict[str, Any], str], AppliedBatchOperation]
SUPPORTED_BATCH_KINDS = (
    "update_task",
    "create_dependency",
    "update_dependency",
    "remove_dependency",
    "assign_resource",
    "unassign_resource",
    "set_calendar",
    "create_link",
    "remove_link",
    "transition_gate",
)
_HANDLERS: dict[str, BatchOperationHandler] = {
    "update_task": update_task,
    "create_dependency": create_dependency,
    "update_dependency": update_dependency,
    "remove_dependency": remove_dependency,
    "assign_resource": assign_resource,
    "unassign_resource": unassign_resource,
    "set_calendar": set_calendar,
    "create_link": create_link,
    "remove_link": remove_link,
    "transition_gate": transition_gate,
}


def apply_batch_operation(
    db: Session,
    actor: Actor,
    project: PlanningProject,
    kind: str,
    payload: dict[str, Any],
    command_id: str,
) -> AppliedBatchOperation:
    return _HANDLERS[kind](db, actor, project, payload, command_id)


def required_batch_permission(kind: str, payload: dict[str, Any]) -> str:
    if kind in {"create_link", "remove_link"}:
        return "planning.link"
    if kind == "transition_gate" and str(payload.get("action") or "") in {"satisfy", "reject", "waive"}:
        return "planning.gate.approve"
    return "planning.edit"


def batch_operation_authorized(actor: Actor, kind: str, payload: dict[str, Any]) -> bool:
    return has_permission(actor, required_batch_permission(kind, payload))


__all__ = [
    "SUPPORTED_BATCH_KINDS",
    "apply_batch_operation",
    "batch_operation_authorized",
    "required_batch_permission",
]

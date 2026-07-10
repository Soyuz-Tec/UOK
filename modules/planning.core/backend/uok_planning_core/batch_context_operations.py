from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .advanced_commands import bounded_int, clean_text
from .batch_operation_types import AppliedBatchOperation
from .link_commands import cmd_create_planning_link, cmd_remove_planning_link
from .models import PlanningAssignment, PlanningProject, PlanningResource
from .requirement_commands import cmd_advance_planning_task_requirement, cmd_decide_planning_task_requirement
from .scheduler import task_or_error
from uok.security import Actor


def assign_resource(
    db: Session, actor: Actor, project: PlanningProject, payload: dict[str, Any], _command_id: str,
) -> AppliedBatchOperation:
    _fields(payload, "assign_resource", {"task_id", "resource_id", "allocation_percent"}, {"task_id", "resource_id"})
    task = task_or_error(db, actor, clean_text(payload.get("task_id"), "task_id", 36), project.id)
    resource = _resource(db, actor, project.id, payload.get("resource_id"))
    row = db.scalar(select(PlanningAssignment).where(
        PlanningAssignment.organization_id == actor.organization_id,
        PlanningAssignment.task_id == task.id,
        PlanningAssignment.resource_id == resource.id,
    ))
    if row is None:
        row = PlanningAssignment(organization_id=actor.organization_id, task_id=task.id, resource_id=resource.id)
        db.add(row)
    row.allocation_percent = bounded_int(payload.get("allocation_percent", 100), "allocation_percent", 1, 300)
    db.flush()
    return AppliedBatchOperation([row.id], {task.id})


def unassign_resource(
    db: Session, actor: Actor, project: PlanningProject, payload: dict[str, Any], _command_id: str,
) -> AppliedBatchOperation:
    _fields(payload, "unassign_resource", {"assignment_id", "task_id", "resource_id"})
    assignment_id = str(payload.get("assignment_id") or "").strip()
    if assignment_id:
        row = db.get(PlanningAssignment, clean_text(assignment_id, "assignment_id", 36))
        if not row or row.organization_id != actor.organization_id:
            raise ValueError("assignment_id not found")
        task = task_or_error(db, actor, row.task_id, project.id)
        _resource(db, actor, project.id, row.resource_id)
    else:
        task_id = clean_text(payload.get("task_id"), "task_id", 36)
        resource_id = clean_text(payload.get("resource_id"), "resource_id", 36)
        task = task_or_error(db, actor, task_id, project.id)
        _resource(db, actor, project.id, resource_id)
        row = db.scalar(select(PlanningAssignment).where(
            PlanningAssignment.organization_id == actor.organization_id,
            PlanningAssignment.task_id == task.id,
            PlanningAssignment.resource_id == resource_id,
        ))
        if row is None:
            raise ValueError("assignment not found")
    object_id = row.id
    db.delete(row)
    db.flush()
    return AppliedBatchOperation([object_id], {task.id})


def create_link(
    db: Session, actor: Actor, project: PlanningProject, payload: dict[str, Any], command_id: str,
) -> AppliedBatchOperation:
    _fields(payload, "create_link", {"scope_type", "task_id", "relationship", "blocking", "target"}, {"scope_type", "relationship", "target"})
    result = cmd_create_planning_link(db, actor, {**payload, "project_id": project.id}, command_id)
    task_ids = {str(payload["task_id"])} if payload.get("task_id") else set()
    return AppliedBatchOperation([str(result["id"])], task_ids)


def remove_link(
    db: Session, actor: Actor, project: PlanningProject, payload: dict[str, Any], command_id: str,
) -> AppliedBatchOperation:
    _fields(payload, "remove_link", {"link_id"}, {"link_id"})
    result = cmd_remove_planning_link(db, actor, {**payload, "project_id": project.id}, command_id)
    task_ids = {str(result["task_id"])} if result.get("task_id") else set()
    return AppliedBatchOperation([str(result["id"])], task_ids)


def transition_gate(
    db: Session, actor: Actor, project: PlanningProject, payload: dict[str, Any], command_id: str,
) -> AppliedBatchOperation:
    _fields(payload, "transition_gate", {"task_id", "requirement_id", "action", "reason"}, {"task_id", "requirement_id", "action"})
    task = task_or_error(db, actor, clean_text(payload.get("task_id"), "task_id", 36), project.id)
    action = str(payload.get("action") or "").strip()
    command_payload = {"task_id": task.id, "requirement_id": payload["requirement_id"]}
    if action in {"submit", "start_review"}:
        result = cmd_advance_planning_task_requirement(db, actor, {**command_payload, "action": action}, command_id)
    elif action in {"satisfy", "reject", "waive"}:
        result = cmd_decide_planning_task_requirement(
            db, actor, {**command_payload, "decision": action, "reason": payload.get("reason")}, command_id,
        )
    else:
        raise ValueError("action must be submit, start_review, satisfy, reject, or waive")
    return AppliedBatchOperation([str(result["id"])], {task.id})


def _resource(db: Session, actor: Actor, project_id: str, value: Any) -> PlanningResource:
    row = db.get(PlanningResource, clean_text(value, "resource_id", 36))
    if not row or row.organization_id != actor.organization_id or row.project_id != project_id:
        raise ValueError("resource_id not found")
    return row


def _fields(payload: dict[str, Any], kind: str, allowed: set[str], required: set[str] | None = None) -> None:
    unknown = sorted(set(payload) - allowed)
    if unknown:
        raise ValueError(f"{kind} payload contains unsupported fields: {', '.join(unknown)}")
    missing = sorted(name for name in (required or set()) if payload.get(name) in (None, ""))
    if missing:
        raise ValueError(f"{kind} payload requires: {', '.join(missing)}")


__all__ = ["assign_resource", "create_link", "remove_link", "transition_gate", "unassign_resource"]

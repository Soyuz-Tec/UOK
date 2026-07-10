from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .advanced_commands import clean_text
from .date_semantics import parse_execution_date
from .link_resolver import serialize_link
from .models import PlanningLink, PlanningTaskRequirement, utcnow
from .planning_audit import add_planning_schedule_event, emit_planning_event
from .requirement_read_model import serialize_requirement
from .scheduler import project_or_error, task_or_error
from uok.command_context import CommandDomainError
from uok.security import Actor

REQUIREMENT_TYPES = ("evidence", "approval", "compliance", "finance", "shipment", "document", "custom")
ADVANCE_TRANSITIONS = {"submit": {"missing", "rejected"}, "start_review": {"submitted"}}
DECISION_STATES = {"satisfy": "satisfied", "reject": "rejected", "waive": "waived"}
LINK_REQUIRED_TYPES = {"evidence", "document", "shipment"}
REQUIREMENT_TARGET_KINDS = {
    "evidence": {"evidence"},
    "document": {"document"},
    "shipment": {"shipment"},
}


def cmd_create_planning_task_requirement(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    task = task_or_error(db, actor, clean_text(payload.get("task_id"), "task_id", 36))
    project = project_or_error(db, actor, task.project_id)
    requirement_type = _controlled(payload.get("requirement_type"), "requirement_type", set(REQUIREMENT_TYPES))
    target_link = _target_link(db, actor, project.id, task.id, payload.get("target_link_id"))
    _validate_target_kind(requirement_type, target_link)
    requirement = PlanningTaskRequirement(
        organization_id=actor.organization_id,
        project_id=project.id,
        task_id=task.id,
        requirement_type=requirement_type,
        title=clean_text(payload.get("title"), "title", 180),
        required=bool(payload.get("required", True)),
        target_link_id=target_link.id if target_link else None,
        due_at=parse_execution_date(payload.get("due"), "due", project.timezone_name) if payload.get("due") else None,
        created_by_actor_id=actor.user_id,
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    db.add(requirement)
    db.flush()
    _emit(db, actor, command_id, project.id, requirement, "PlanningTaskRequirementCreated", "task_requirement_created")
    return serialize_requirement(requirement, serialize_link(db, actor, target_link) if target_link else None)


def cmd_advance_planning_task_requirement(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    requirement, project = _requirement_context(db, actor, payload)
    action = _controlled(payload.get("action"), "action", set(ADVANCE_TRANSITIONS))
    if requirement.state not in ADVANCE_TRANSITIONS[action]:
        raise _transition_error(project.revision, command_id, requirement, action)
    requirement.state = "submitted" if action == "submit" else "under_review"
    requirement.decision_reason = None
    requirement.decided_by_actor_id = None
    requirement.decided_at = None
    requirement.updated_at = utcnow()
    _emit(db, actor, command_id, project.id, requirement, "PlanningTaskRequirementAdvanced", "task_requirement_advanced", {"action": action})
    return serialize_requirement(requirement, _serialized_link(db, actor, requirement))


def cmd_set_planning_task_requirement_link(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    requirement, project = _requirement_context(db, actor, payload)
    target_link = _target_link(db, actor, project.id, requirement.task_id, payload.get("target_link_id"))
    _validate_target_kind(requirement.requirement_type, target_link)
    target_link_id = target_link.id if target_link else None
    if requirement.target_link_id == target_link_id:
        raise ValueError("target_link_id already identifies the current requirement source")
    requirement.target_link_id = target_link_id
    if target_link is None and requirement.requirement_type in LINK_REQUIRED_TYPES:
        requirement.state = "missing"
        _clear_decision(requirement)
    elif requirement.state in {"under_review", "satisfied", "rejected"}:
        requirement.state = "submitted"
        _clear_decision(requirement)
    requirement.updated_at = utcnow()
    _emit(
        db, actor, command_id, project.id, requirement,
        "PlanningTaskRequirementLinkSet", "task_requirement_link_set",
        {"target_link_id": target_link_id},
    )
    return serialize_requirement(requirement, serialize_link(db, actor, target_link) if target_link else None)


def cmd_decide_planning_task_requirement(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    requirement, project = _requirement_context(db, actor, payload)
    decision = _controlled(payload.get("decision"), "decision", set(DECISION_STATES))
    if requirement.state != "under_review":
        raise _transition_error(project.revision, command_id, requirement, decision)
    reason = clean_text(payload.get("reason"), "reason", 500)
    target_link = _linked_row(db, actor, requirement)
    if decision == "satisfy" and requirement.requirement_type in LINK_REQUIRED_TYPES:
        if target_link is None or serialize_link(db, actor, target_link)["resolution"]["status"] != "ready":
            raise CommandDomainError(
                code="planning_requirement_evidence_not_ready",
                message="This requirement needs a ready linked source before it can be satisfied.",
                field="target_link_id",
                object_ids=[requirement.task_id, requirement.id],
                repair="Attach a ready evidence, document, or shipment link, then retry the decision.",
                current_revision=int(project.revision),
                correlation_id=command_id,
            )
    requirement.state = DECISION_STATES[decision]
    requirement.decision_reason = reason
    requirement.decided_by_actor_id = actor.user_id
    requirement.decided_at = utcnow()
    requirement.updated_at = requirement.decided_at
    _emit(db, actor, command_id, project.id, requirement, "PlanningTaskRequirementDecided", "task_requirement_decided", {"decision": decision, "reason": reason})
    return serialize_requirement(requirement, serialize_link(db, actor, target_link) if target_link else None)


def _requirement_context(db: Session, actor: Actor, payload: dict[str, Any]):
    task = task_or_error(db, actor, clean_text(payload.get("task_id"), "task_id", 36))
    project = project_or_error(db, actor, task.project_id)
    requirement = db.get(PlanningTaskRequirement, clean_text(payload.get("requirement_id"), "requirement_id", 36))
    if not requirement or requirement.organization_id != actor.organization_id or requirement.task_id != task.id:
        raise ValueError("requirement_id not found")
    return requirement, project


def _target_link(db: Session, actor: Actor, project_id: str, task_id: str, value: Any) -> PlanningLink | None:
    if not value:
        return None
    link = db.scalar(select(PlanningLink).where(
        PlanningLink.id == clean_text(value, "target_link_id", 36),
        PlanningLink.organization_id == actor.organization_id,
        PlanningLink.project_id == project_id,
    ))
    if not link or (link.task_id is not None and link.task_id != task_id):
        raise ValueError("target_link_id not found for this task or project")
    return link


def _linked_row(db: Session, actor: Actor, requirement: PlanningTaskRequirement) -> PlanningLink | None:
    return _target_link(db, actor, requirement.project_id, requirement.task_id, requirement.target_link_id)


def _validate_target_kind(requirement_type: str, target_link: PlanningLink | None) -> None:
    accepted = REQUIREMENT_TARGET_KINDS.get(requirement_type)
    if target_link is not None and accepted is not None and target_link.target_kind not in accepted:
        raise ValueError(
            f"target_link_id for {requirement_type} requirements must reference a "
            f"{', '.join(sorted(accepted))} Planning link"
        )


def _serialized_link(db: Session, actor: Actor, requirement: PlanningTaskRequirement) -> dict[str, Any] | None:
    row = _linked_row(db, actor, requirement)
    return serialize_link(db, actor, row) if row else None


def _clear_decision(requirement: PlanningTaskRequirement) -> None:
    requirement.decision_reason = None
    requirement.decided_by_actor_id = None
    requirement.decided_at = None


def _emit(db: Session, actor: Actor, command_id: str, project_id: str, row: PlanningTaskRequirement, module_event: str, schedule_event: str, extra: dict[str, Any] | None = None) -> None:
    payload = {"project_id": project_id, "task_id": row.task_id, "requirement_id": row.id, "state": row.state, **(extra or {})}
    emit_planning_event(db, actor, command_id, module_event, "PlanningTaskRequirement", row.id, payload)
    add_planning_schedule_event(db, actor, command_id, project_id, schedule_event, payload)


def _controlled(value: Any, field: str, accepted: set[str]) -> str:
    selected = str(value or "").strip()
    if selected not in accepted:
        raise ValueError(f"{field} must be {', '.join(sorted(accepted))}")
    return selected


def _transition_error(revision: int, command_id: str, row: PlanningTaskRequirement, action: str) -> CommandDomainError:
    return CommandDomainError(
        code="planning_requirement_transition_invalid",
        message=f"Requirement state {row.state} cannot accept action {action}.",
        field="state",
        object_ids=[row.task_id, row.id],
        repair="Reload the requirement and choose an action allowed by its current state.",
        current_revision=int(revision),
        correlation_id=command_id,
    )


__all__ = [
    "cmd_advance_planning_task_requirement",
    "cmd_create_planning_task_requirement",
    "cmd_decide_planning_task_requirement",
    "cmd_set_planning_task_requirement_link",
]

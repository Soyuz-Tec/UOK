from __future__ import annotations

from typing import Any

from uok.command_context import CommandDomainError

from .advanced_commands import clean_text
from .models import PlanningProject, utcnow
from .planning_audit import add_planning_schedule_event, emit_planning_event
from .read_model import serialize_project
from uok.security import Actor
from sqlalchemy.orm import Session

PROJECT_STATUSES = ("draft", "active", "on_hold", "completed", "archived", "purged")
PUBLIC_PROJECT_STATUSES = PROJECT_STATUSES[:-1]
PROJECT_STATUS_TRANSITIONS = {
    "draft": {"active", "archived"},
    "active": {"on_hold", "completed", "archived"},
    "on_hold": {"active", "completed", "archived"},
    "completed": {"active", "archived"},
    "archived": {"active"},
    "purged": set(),
}


def cmd_transition_project(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    project = db.get(PlanningProject, clean_text(payload.get("project_id"), "project_id", 36))
    if not project or project.organization_id != actor.organization_id or project.status == "purged":
        raise ValueError("project_id not found")
    target = str(payload.get("target_status") or "").strip()
    reason = clean_text(payload.get("reason"), "reason", 500)
    _assert_transition(project, target, command_id)
    previous = project.status
    project._planning_transition_allowed = True
    project.status = target
    project.updated_at = utcnow()
    event_payload = {"project_id": project.id, "from_status": previous, "target_status": target, "reason": reason}
    emit_planning_event(db, actor, command_id, "PlanningProjectTransitioned", "PlanningProject", project.id, event_payload)
    add_planning_schedule_event(db, actor, command_id, project.id, "project_transitioned", event_payload)
    return serialize_project(project)


def assert_project_mutation_allowed(project: PlanningProject, command_type: str, command_id: str) -> None:
    if project.status == "purged":
        raise CommandDomainError(
            code="planning_object_not_found",
            message="project_id not found",
            field="project_id",
            object_ids=[],
            repair="Reload the visible Planning project list before retrying.",
            current_revision=None,
            correlation_id=None,
            attach_correlation=False,
        )
    if project.status != "archived" or command_type == "TransitionPlanningProject":
        return
    raise CommandDomainError(
        code="planning_project_archived",
        message="Archived Planning projects are read-only.",
        field="project_id",
        object_ids=[project.id],
        repair="Transition the project back to active before submitting another Planning mutation.",
        current_revision=int(project.revision),
        correlation_id=command_id,
    )


def _assert_transition(project: PlanningProject, target: str, command_id: str) -> None:
    allowed = PROJECT_STATUS_TRANSITIONS.get(project.status, set())
    if target not in PUBLIC_PROJECT_STATUSES or target == project.status or target not in allowed:
        choices = ", ".join(sorted(allowed)) or "none"
        raise CommandDomainError(
            code="planning_project_transition_invalid",
            message=f"project status cannot transition from {project.status} to {target or 'unknown'}",
            field="target_status",
            object_ids=[project.id],
            repair=f"Choose one of the allowed next states: {choices}.",
            current_revision=int(project.revision),
            correlation_id=command_id,
        )


__all__ = [
    "PROJECT_STATUSES",
    "PROJECT_STATUS_TRANSITIONS",
    "PUBLIC_PROJECT_STATUSES",
    "assert_project_mutation_allowed",
    "cmd_transition_project",
]

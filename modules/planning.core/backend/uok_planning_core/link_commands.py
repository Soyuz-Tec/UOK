from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .advanced_commands import clean_text
from .link_resolver import LINK_RELATIONSHIPS, resolve_target, resolver_spec, serialize_link
from .models import PlanningLink, PlanningTaskRequirement, utcnow
from .planning_audit import add_planning_schedule_event, emit_planning_event
from .scheduler import project_or_error, task_or_error
from uok.command_context import CommandDomainError
from uok.security import Actor
from uok.util import dumps


def cmd_create_planning_link(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    project = project_or_error(db, actor, clean_text(payload.get("project_id"), "project_id", 36))
    scope_type = _controlled_value(payload.get("scope_type"), "scope_type", {"project", "task"})
    task_id = str(payload.get("task_id") or "").strip() or None
    if scope_type == "project" and task_id is not None:
        raise ValueError("task_id must be omitted for project links")
    if scope_type == "task":
        if task_id is None:
            raise ValueError("task_id is required for task links")
        task_or_error(db, actor, task_id, project.id)
    relationship = _controlled_value(payload.get("relationship"), "relationship", set(LINK_RELATIONSHIPS))
    target = payload.get("target")
    if not isinstance(target, dict):
        raise ValueError("target must be an object")
    target_kind = clean_text(target.get("kind"), "target.kind", 40)
    target_id = clean_text(target.get("id"), "target.id", 180)
    spec = resolver_spec(target_kind)
    duplicate = db.scalar(select(PlanningLink).where(
        PlanningLink.organization_id == actor.organization_id,
        PlanningLink.project_id == project.id,
        PlanningLink.scope_type == scope_type,
        PlanningLink.task_id.is_(None) if task_id is None else PlanningLink.task_id == task_id,
        PlanningLink.relationship == relationship,
        PlanningLink.target_kind == target_kind,
        PlanningLink.target_id == target_id,
        PlanningLink.resolver == spec.name,
    ))
    if duplicate is not None:
        raise CommandDomainError(
            code="planning_link_exists", message="This Planning link already exists.", status_code=409,
            field="target.id", object_ids=[duplicate.id, target_id],
            repair="Use the existing link or remove it before creating a replacement.",
            current_revision=int(project.revision), correlation_id=command_id,
        )
    resolution = resolve_target(db, actor, target_kind, target_id)
    if resolution.status in {"denied", "missing"}:
        raise CommandDomainError(
            code=f"planning_link_target_{resolution.status}", message=resolution.status_summary,
            status_code=403 if resolution.status == "denied" else 400, field="target.id",
            object_ids=[] if resolution.status == "denied" else [target_id],
            repair="Confirm the target module, permission, and organization-scoped target identity, then retry.",
            current_revision=int(project.revision), correlation_id=command_id,
        )
    link = PlanningLink(
        organization_id=actor.organization_id, project_id=project.id, task_id=task_id,
        scope_type=scope_type, relationship=relationship, target_kind=target_kind, target_id=target_id,
        resolver=spec.name, resolver_version=spec.version, blocking=bool(payload.get("blocking", False)),
        resolution_status=resolution.status, status_summary=resolution.status_summary,
        provenance_json=dumps({"correlation_id": command_id, "resolver": spec.name, "resolver_version": spec.version}),
        created_by_actor_id=actor.user_id, last_resolved_at=utcnow(),
    )
    db.add(link)
    db.flush()
    event_payload = {"project_id": project.id, "task_id": task_id, "link_id": link.id, "target_kind": target_kind, "resolution_status": resolution.status}
    emit_planning_event(db, actor, command_id, "PlanningLinkCreated", "PlanningLink", link.id, event_payload)
    add_planning_schedule_event(db, actor, command_id, project.id, "link_created", event_payload)
    return serialize_link(db, actor, link)


def cmd_remove_planning_link(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    project = project_or_error(db, actor, clean_text(payload.get("project_id"), "project_id", 36))
    link = db.scalar(select(PlanningLink).where(
        PlanningLink.id == clean_text(payload.get("link_id"), "link_id", 36),
        PlanningLink.organization_id == actor.organization_id,
        PlanningLink.project_id == project.id,
    ))
    if link is None:
        raise ValueError("link_id not found")
    requirement_id = db.scalar(select(PlanningTaskRequirement.id).where(
        PlanningTaskRequirement.organization_id == actor.organization_id,
        PlanningTaskRequirement.target_link_id == link.id,
    ))
    if requirement_id:
        raise CommandDomainError(
            code="planning_link_in_use", message="This Planning link is attached to a task requirement.",
            field="link_id", object_ids=[link.id, requirement_id],
            repair="Complete or replace the requirement workflow before removing its source link.",
            current_revision=int(project.revision), correlation_id=command_id,
        )
    link_id = link.id
    event_payload = {"project_id": project.id, "task_id": link.task_id, "link_id": link_id, "target_kind": link.target_kind}
    db.delete(link)
    emit_planning_event(db, actor, command_id, "PlanningLinkRemoved", "PlanningLink", link_id, event_payload)
    add_planning_schedule_event(db, actor, command_id, project.id, "link_removed", event_payload)
    return {"id": link_id, "project_id": project.id, "removed": True}


def _controlled_value(value: Any, field: str, accepted: set[str]) -> str:
    selected = str(value or "").strip()
    if selected not in accepted:
        raise ValueError(f"{field} must be {', '.join(sorted(accepted))}")
    return selected


__all__ = ["cmd_create_planning_link", "cmd_remove_planning_link"]

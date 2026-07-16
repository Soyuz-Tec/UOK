from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok_planning_core._internal.scheduling.advanced_commands import clean_text
from uok_planning_core._internal.coordination.link_resolver import resolve_target
from uok_planning_core._internal.persistence.models import PlanningTaskParticipant, utcnow
from uok_planning_core._internal.coordination.participant_resolver import planning_participant_role, serialize_participant
from uok_planning_core._internal.portfolio_audit.planning_audit import add_planning_schedule_event, emit_planning_event
from uok_planning_core._internal.scheduling.scheduler import project_or_error, task_or_error
from uok.command_context import CommandDomainError
from uok.security import Actor


def cmd_add_planning_task_participant(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    task = task_or_error(db, actor, clean_text(payload.get("task_id"), "task_id", 36))
    project = project_or_error(db, actor, task.project_id)
    party_id = clean_text(payload.get("party_id"), "party_id", 36)
    role = planning_participant_role(payload.get("role"))
    resolution = resolve_target(db, actor, "party", party_id)
    if resolution.status != "ready":
        raise _participant_error(project.revision, command_id, resolution.status, party_id, task.id)
    duplicate = db.scalar(select(PlanningTaskParticipant).where(
        PlanningTaskParticipant.organization_id == actor.organization_id,
        PlanningTaskParticipant.task_id == task.id,
        PlanningTaskParticipant.party_id == party_id,
        PlanningTaskParticipant.role == role,
    ))
    if duplicate:
        raise CommandDomainError(
            code="planning_participant_duplicate",
            message="The party already has this role on the task.",
            field="role",
            object_ids=[project.id, task.id, party_id, duplicate.id],
            repair="Choose a different role or remove the existing participant record first.",
            current_revision=int(project.revision),
            correlation_id=command_id,
        )
    participant = PlanningTaskParticipant(
        organization_id=actor.organization_id,
        project_id=project.id,
        task_id=task.id,
        party_id=party_id,
        role=role,
        created_by_actor_id=actor.user_id,
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    db.add(participant)
    db.flush()
    event_payload = {"project_id": project.id, "task_id": task.id, "participant_id": participant.id, "party_id": party_id, "role": role}
    emit_planning_event(db, actor, command_id, "PlanningTaskParticipantAdded", "PlanningTaskParticipant", participant.id, event_payload)
    add_planning_schedule_event(db, actor, command_id, project.id, "task_participant_added", event_payload)
    return serialize_participant(db, actor, participant)


def cmd_remove_planning_task_participant(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    task = task_or_error(db, actor, clean_text(payload.get("task_id"), "task_id", 36))
    project = project_or_error(db, actor, task.project_id)
    participant_id = clean_text(payload.get("participant_id"), "participant_id", 36)
    participant = db.get(PlanningTaskParticipant, participant_id)
    if not participant or participant.organization_id != actor.organization_id or participant.task_id != task.id:
        raise ValueError("participant_id not found")
    event_payload = {"project_id": project.id, "task_id": task.id, "participant_id": participant.id, "party_id": participant.party_id, "role": participant.role}
    db.delete(participant)
    emit_planning_event(db, actor, command_id, "PlanningTaskParticipantRemoved", "PlanningTaskParticipant", participant.id, event_payload)
    add_planning_schedule_event(db, actor, command_id, project.id, "task_participant_removed", event_payload)
    return {"id": participant.id, "project_id": project.id, "task_id": task.id, "removed": True}


def _participant_error(revision: int, command_id: str, status: str, party_id: str, task_id: str) -> CommandDomainError:
    messages = {
        "denied": ("planning_participant_party_denied", "The party is not visible to this actor.", "Use a Party identity the current actor is authorized to read."),
        "missing": ("planning_participant_party_missing", "The party does not exist in this organization.", "Choose a canonical Party from the current organization."),
        "unavailable": ("planning_participant_party_unavailable", "The Party provider or target is unavailable.", "Enable Contacts and choose an active canonical Party."),
    }
    code, message, repair = messages.get(status, messages["unavailable"])
    return CommandDomainError(code=code, message=message, field="party_id", object_ids=[task_id, party_id], repair=repair, current_revision=int(revision), correlation_id=command_id)


__all__ = ["cmd_add_planning_task_participant", "cmd_remove_planning_task_participant"]

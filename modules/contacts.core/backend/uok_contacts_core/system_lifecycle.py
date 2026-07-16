from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok.command_context import COMMAND_IF_MATCH_CONTEXT_KEY, CommandPreconditionError
from uok.security import Actor

from .command_support import _emit_event
from .models import utcnow
from .system_command_support import (
    bounded_text,
    contact_custom_field_etag,
    contact_lifecycle_revision,
    contact_team_etag,
    serialize_custom_field_definition,
    serialize_team,
)
from .system_models import ContactCustomFieldDefinition, ContactTeam


def cmd_delete_contact_team(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    team = _locked_team(db, actor, bounded_text(payload.get("team_id"), 80))
    _require_current_etag(
        team,
        payload,
        current_etag=contact_team_etag(team),
        code_prefix="contact_team",
        object_name="contact team",
        reload_url="/api/contacts/teams?include_archived=true",
    )
    reason = _delete_reason(payload)
    if team.status != "archived":
        now = utcnow()
        team.status = "archived"
        team.archived_at = now
        team.updated_at = now
        _emit_event(db, actor, "ContactTeamDeleted", "ContactTeam", team.id, {
            "name": team.name,
            "reason": reason,
        })
    return serialize_team(db, team, actor)


def cmd_restore_contact_team(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    team = _locked_team(db, actor, bounded_text(payload.get("team_id"), 80))
    _require_current_etag(
        team,
        payload,
        current_etag=contact_team_etag(team),
        code_prefix="contact_team",
        object_name="contact team",
        reload_url="/api/contacts/teams?include_archived=true",
    )
    if team.status != "active":
        team.status = "active"
        team.archived_at = None
        team.updated_at = utcnow()
        _emit_event(db, actor, "ContactTeamRestored", "ContactTeam", team.id, {"name": team.name})
    return serialize_team(db, team, actor)


def cmd_delete_contact_custom_field(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    definition = _locked_custom_field(db, actor, bounded_text(payload.get("field_definition_id"), 80))
    _require_current_etag(
        definition,
        payload,
        current_etag=contact_custom_field_etag(definition),
        code_prefix="contact_custom_field",
        object_name="custom-field definition",
        reload_url="/api/contacts/custom-fields?include_archived=true",
    )
    reason = _delete_reason(payload)
    if definition.status != "archived":
        definition.status = "archived"
        definition.updated_at = utcnow()
        _emit_event(db, actor, "ContactCustomFieldDeleted", "ContactCustomFieldDefinition", definition.id, {
            "field_key": definition.field_key,
            "reason": reason,
        })
    return serialize_custom_field_definition(actor, definition)


def cmd_restore_contact_custom_field(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    definition = _locked_custom_field(db, actor, bounded_text(payload.get("field_definition_id"), 80))
    _require_current_etag(
        definition,
        payload,
        current_etag=contact_custom_field_etag(definition),
        code_prefix="contact_custom_field",
        object_name="custom-field definition",
        reload_url="/api/contacts/custom-fields?include_archived=true",
    )
    if definition.status != "active":
        definition.status = "active"
        definition.updated_at = utcnow()
        _emit_event(db, actor, "ContactCustomFieldRestored", "ContactCustomFieldDefinition", definition.id, {
            "field_key": definition.field_key,
        })
    return serialize_custom_field_definition(actor, definition)


def _locked_team(db: Session, actor: Actor, team_id: str) -> ContactTeam:
    team = db.scalar(select(ContactTeam).where(
        ContactTeam.id == team_id,
        ContactTeam.organization_id == actor.organization_id,
    ).with_for_update())
    if not team:
        raise ValueError("contact team not found")
    return team


def _locked_custom_field(
    db: Session,
    actor: Actor,
    field_definition_id: str,
) -> ContactCustomFieldDefinition:
    definition = db.scalar(select(ContactCustomFieldDefinition).where(
        ContactCustomFieldDefinition.id == field_definition_id,
        ContactCustomFieldDefinition.organization_id == actor.organization_id,
    ).with_for_update())
    if not definition:
        raise ValueError("custom field definition not found")
    return definition


def _delete_reason(payload: dict[str, Any]) -> str:
    reason = bounded_text(payload.get("reason"), 500)
    if len(reason) < 3:
        raise ValueError("delete reason must be at least 3 characters")
    return reason


def _require_current_etag(
    row: ContactTeam | ContactCustomFieldDefinition,
    payload: dict[str, Any],
    *,
    current_etag: str,
    code_prefix: str,
    object_name: str,
    reload_url: str,
) -> None:
    supplied = str(payload.get(COMMAND_IF_MATCH_CONTEXT_KEY) or "").strip()
    common = {
        "current_revision": contact_lifecycle_revision(row.updated_at),
        "current_etag": current_etag,
        "object_ids": [row.id],
        "reload_url": reload_url,
    }
    if not supplied:
        raise CommandPreconditionError(
            code=f"{code_prefix}_precondition_required",
            message=f"A current {object_name} ETag is required for this lifecycle change.",
            status_code=428,
            repair=f"Reload the {object_name}, review its latest details, then confirm the action again.",
            **common,
        )
    if supplied != current_etag:
        raise CommandPreconditionError(
            code=f"{code_prefix}_precondition_stale",
            message=f"The {object_name} changed after this action was prepared.",
            status_code=412,
            repair=f"The latest {object_name} has been loaded. Review it, then confirm the action again.",
            **common,
        )

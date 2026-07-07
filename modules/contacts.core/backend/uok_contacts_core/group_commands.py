from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .command_support import _emit_event
from .group_domain_commands import cmd_group_contacts_by_business_email_domain
from .group_membership_commands import cmd_add_contacts_to_group, cmd_remove_contact_from_group
from .group_read_model import get_contact_group_or_error, serialize_contact_group
from .models import ContactGroup, utcnow
from .validation import (
    bounded_text,
    contact_group_kind,
    contact_group_visibility_scope,
    validate_contact_payload_lengths,
)
from uok.security import Actor
from uok.util import dumps


def cmd_create_contact_group(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    validate_contact_payload_lengths(payload)
    name = bounded_text(payload.get("name") or payload.get("group_name"), "group_name")
    if not name:
        raise ValueError("contact group name is required")
    existing = db.scalar(select(ContactGroup).where(
        ContactGroup.organization_id == actor.organization_id,
        ContactGroup.name == name,
    ))
    if existing:
        if existing.status == "archived":
            existing.status = "active"
            existing.archived_at = None
            existing.updated_at = utcnow()
            _emit_event(db, actor, "ContactGroupUpdated", "ContactGroup", existing.id, {"name": existing.name, "restored": True})
            return serialize_contact_group(db, existing)
        raise ValueError("contact group name already exists")
    now = utcnow()
    group = ContactGroup(
        organization_id=actor.organization_id,
        name=name,
        description=bounded_text(payload.get("description"), "group_description"),
        kind=contact_group_kind(payload.get("kind")),
        visibility_scope=contact_group_visibility_scope(payload.get("visibility_scope")),
        owner_user_id=bounded_text(payload.get("owner_user_id"), "owner_user_id") or actor.user_id,
        team_id=bounded_text(payload.get("team_id"), "team_id") or None,
        attrs_json=dumps({}),
        created_at=now,
        updated_at=now,
    )
    db.add(group)
    db.flush()
    _emit_event(db, actor, "ContactGroupCreated", "ContactGroup", group.id, {"name": group.name})
    return serialize_contact_group(db, group)


def cmd_update_contact_group(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    validate_contact_payload_lengths(payload)
    group = get_contact_group_or_error(db, actor, bounded_text(payload.get("group_id"), "group_id"))
    if "name" in payload or "group_name" in payload:
        next_name = bounded_text(payload.get("name") or payload.get("group_name"), "group_name")
        if not next_name:
            raise ValueError("contact group name is required")
        duplicate = db.scalar(select(ContactGroup).where(
            ContactGroup.organization_id == actor.organization_id,
            ContactGroup.name == next_name,
            ContactGroup.id != group.id,
        ))
        if duplicate:
            raise ValueError("contact group name already exists")
        group.name = next_name
    if "description" in payload:
        group.description = bounded_text(payload.get("description"), "group_description")
    if "visibility_scope" in payload:
        group.visibility_scope = contact_group_visibility_scope(payload.get("visibility_scope"))
    if "team_id" in payload:
        group.team_id = bounded_text(payload.get("team_id"), "team_id") or None
    group.updated_at = utcnow()
    _emit_event(db, actor, "ContactGroupUpdated", "ContactGroup", group.id, {"name": group.name})
    return serialize_contact_group(db, group)


def cmd_archive_contact_group(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    validate_contact_payload_lengths(payload)
    group = get_contact_group_or_error(db, actor, bounded_text(payload.get("group_id"), "group_id"))
    group.status = "archived"
    group.archived_at = utcnow()
    group.updated_at = utcnow()
    _emit_event(db, actor, "ContactGroupArchived", "ContactGroup", group.id, {"name": group.name})
    return serialize_contact_group(db, group)

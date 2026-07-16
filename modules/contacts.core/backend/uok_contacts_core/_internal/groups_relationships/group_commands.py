from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok_contacts_core._internal.delivery.command_support import _emit_event
from uok_contacts_core._internal.registry.access import validate_contact_assignment
from uok_contacts_core._internal.groups_relationships.group_read_model import (
    ensure_manually_managed_contact_group,
    get_contact_group_or_error,
    serialize_contact_group,
)
from uok_contacts_core._internal.persistence.models import ContactGroup, utcnow
from uok_contacts_core._internal.registry.validation import (
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
            raise ValueError("contact group is archived; use RestoreContactGroup")
        raise ValueError("contact group name already exists")
    kind = contact_group_kind(payload.get("kind"))
    if kind != "manual":
        raise ValueError("generated contact groups must be created by their generator")
    now = utcnow()
    owner_user_id = bounded_text(payload.get("owner_user_id"), "owner_user_id") or actor.user_id
    team_id = bounded_text(payload.get("team_id"), "team_id") or None
    visibility_scope = contact_group_visibility_scope(payload.get("visibility_scope"))
    validate_contact_assignment(
        db,
        actor,
        owner_user_id=owner_user_id,
        team_id=team_id,
        visibility_scope=visibility_scope,
    )
    group = ContactGroup(
        organization_id=actor.organization_id,
        name=name,
        description=bounded_text(payload.get("description"), "group_description"),
        kind=kind,
        visibility_scope=visibility_scope,
        owner_user_id=owner_user_id,
        team_id=team_id,
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
    ensure_manually_managed_contact_group(group)
    if group.status == "archived":
        raise ValueError("archived contact groups cannot be edited; restore the group first")
    changed_fields: list[str] = []
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
        if group.name != next_name:
            group.name = next_name
            changed_fields.append("name")
    if "description" in payload:
        description = bounded_text(payload.get("description"), "group_description")
        if group.description != description:
            group.description = description
            changed_fields.append("description")
    if "visibility_scope" in payload:
        visibility_scope = contact_group_visibility_scope(payload.get("visibility_scope"))
        if group.visibility_scope != visibility_scope:
            group.visibility_scope = visibility_scope
            changed_fields.append("visibility_scope")
    if "team_id" in payload:
        team_id = bounded_text(payload.get("team_id"), "team_id") or None
        if group.team_id != team_id:
            group.team_id = team_id
            changed_fields.append("team_id")
    validate_contact_assignment(
        db,
        actor,
        owner_user_id=group.owner_user_id,
        team_id=group.team_id,
        visibility_scope=group.visibility_scope,
    )
    if changed_fields:
        group.updated_at = utcnow()
        _emit_event(db, actor, "ContactGroupUpdated", "ContactGroup", group.id, {
            "name": group.name,
            "changed_fields": changed_fields,
        })
    return serialize_contact_group(db, group)


def cmd_archive_contact_group(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    validate_contact_payload_lengths(payload)
    group = get_contact_group_or_error(db, actor, bounded_text(payload.get("group_id"), "group_id"))
    ensure_manually_managed_contact_group(group)
    if group.status == "archived":
        return serialize_contact_group(db, group)
    group.status = "archived"
    group.archived_at = utcnow()
    group.updated_at = utcnow()
    _emit_event(db, actor, "ContactGroupArchived", "ContactGroup", group.id, {"name": group.name})
    return serialize_contact_group(db, group)


def cmd_restore_contact_group(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    validate_contact_payload_lengths(payload)
    group = get_contact_group_or_error(db, actor, bounded_text(payload.get("group_id"), "group_id"))
    ensure_manually_managed_contact_group(group)
    if group.status == "active":
        return serialize_contact_group(db, group)
    group.status = "active"
    group.archived_at = None
    group.updated_at = utcnow()
    _emit_event(db, actor, "ContactGroupRestored", "ContactGroup", group.id, {"name": group.name})
    return serialize_contact_group(db, group)

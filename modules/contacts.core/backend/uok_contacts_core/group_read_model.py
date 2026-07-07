from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .access import can_manage_contacts, readable_party_filter
from .models import ContactGroup, ContactGroupMember, Party
from uok.security import Actor, has_permission
from uok.util import row_dict


def can_read_contact_group(actor: Actor, group: ContactGroup) -> bool:
    if group.status == "archived" and not can_manage_contacts(actor):
        return False
    if not (has_permission(actor, "contacts.read") or can_manage_contacts(actor)):
        return False
    if can_manage_contacts(actor):
        return True
    if group.owner_user_id and group.owner_user_id == actor.user_id:
        return True
    return group.visibility_scope == "organization"


def get_contact_group_or_error(db: Session, actor: Actor, group_id: str) -> ContactGroup:
    group = db.get(ContactGroup, group_id)
    if not group or group.organization_id != actor.organization_id:
        raise ValueError("contact group not found")
    if not can_read_contact_group(actor, group):
        raise PermissionError("contacts.read")
    return group


def contact_group_rows(db: Session, actor: Actor) -> list[dict[str, Any]]:
    groups = db.scalars(
        select(ContactGroup)
        .where(ContactGroup.organization_id == actor.organization_id)
        .order_by(ContactGroup.sort_order.asc(), ContactGroup.name.asc(), ContactGroup.created_at.asc())
    ).all()
    return [serialize_contact_group(db, row) for row in groups if can_read_contact_group(actor, row) and row.status != "archived"]


def serialize_contact_group(db: Session, group: ContactGroup) -> dict[str, Any]:
    member_count = db.scalar(
        select(func.count(ContactGroupMember.id)).where(
            ContactGroupMember.organization_id == group.organization_id,
            ContactGroupMember.group_id == group.id,
        )
    ) or 0
    active_member_count = db.scalar(
        select(func.count(ContactGroupMember.id))
        .join(Party, Party.id == ContactGroupMember.party_id)
        .where(
            ContactGroupMember.organization_id == group.organization_id,
            ContactGroupMember.group_id == group.id,
            Party.organization_id == group.organization_id,
            Party.status == "active",
        )
    ) or 0
    data = row_dict(group)
    data["member_count"] = int(member_count)
    data["active_member_count"] = int(active_member_count)
    return data


def readable_group_party_ids(db: Session, actor: Actor, group_id: str) -> set[str]:
    group = get_contact_group_or_error(db, actor, group_id)
    if group.status == "archived":
        return set()
    allowed = readable_party_filter(actor)
    rows = db.scalars(
        select(Party)
        .join(ContactGroupMember, ContactGroupMember.party_id == Party.id)
        .where(
            ContactGroupMember.organization_id == actor.organization_id,
            ContactGroupMember.group_id == group.id,
            Party.organization_id == actor.organization_id,
        )
    ).all()
    return {row.id for row in rows if allowed(row)}


def party_contact_group_rows(db: Session, actor: Actor, party_id: str) -> list[dict[str, Any]]:
    rows = db.execute(
        select(ContactGroup, ContactGroupMember)
        .join(ContactGroupMember, ContactGroupMember.group_id == ContactGroup.id)
        .where(
            ContactGroup.organization_id == actor.organization_id,
            ContactGroupMember.organization_id == actor.organization_id,
            ContactGroupMember.party_id == party_id,
            ContactGroup.status != "archived",
        )
        .order_by(ContactGroup.sort_order.asc(), ContactGroup.name.asc())
    ).all()
    result: list[dict[str, Any]] = []
    for group, member in rows:
        if not can_read_contact_group(actor, group):
            continue
        result.append({
            "id": group.id,
            "name": group.name,
            "description": group.description,
            "visibility_scope": group.visibility_scope,
            "member_id": member.id,
            "created_at": member.created_at,
        })
    return result

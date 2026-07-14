from __future__ import annotations

from typing import Any

from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import Session

from .access import actor_contact_team_ids, can_manage_contacts, readable_party_filter
from .models import ContactGroup, ContactGroupMember, Party
from uok.security import Actor, has_permission
from uok.util import row_dict


def can_read_contact_group(actor: Actor, group: ContactGroup, team_ids: set[str] | None = None) -> bool:
    if group.status == "archived" and not can_manage_contacts(actor):
        return False
    if not (has_permission(actor, "contacts.read") or can_manage_contacts(actor)):
        return False
    if can_manage_contacts(actor):
        return True
    if group.owner_user_id and group.owner_user_id == actor.user_id:
        return True
    if group.visibility_scope == "organization":
        return True
    return group.visibility_scope == "team" and bool(group.team_id and group.team_id in (team_ids or set()))


def get_contact_group_or_error(db: Session, actor: Actor, group_id: str) -> ContactGroup:
    group = db.get(ContactGroup, group_id)
    if not group or group.organization_id != actor.organization_id:
        raise ValueError("contact group not found")
    if not can_read_contact_group(actor, group, actor_contact_team_ids(db, actor)):
        raise PermissionError("contacts.read")
    return group


def ensure_manually_managed_contact_group(group: ContactGroup) -> None:
    if group.kind != "manual":
        raise ValueError("generated contact groups are managed by their generator")


def contact_group_rows(
    db: Session,
    actor: Actor,
    *,
    kind: str | None = None,
    include_empty: bool = True,
    include_archived: bool = False,
) -> list[dict[str, Any]]:
    if kind and kind not in {"business_domain", "manual", "smart_rule"}:
        raise ValueError("contact group kind must be one of: business_domain, manual, smart_rule")
    counts = (
        select(
            ContactGroupMember.group_id.label("group_id"),
            func.count(ContactGroupMember.id).label("member_count"),
            func.sum(case((Party.status == "active", 1), else_=0)).label("active_member_count"),
        )
        .join(
            Party,
            and_(
                Party.id == ContactGroupMember.party_id,
                Party.organization_id == ContactGroupMember.organization_id,
            ),
        )
        .where(ContactGroupMember.organization_id == actor.organization_id)
        .group_by(ContactGroupMember.group_id)
        .subquery()
    )
    stmt = (
        select(
            ContactGroup,
            func.coalesce(counts.c.member_count, 0),
            func.coalesce(counts.c.active_member_count, 0),
        )
        .outerjoin(counts, counts.c.group_id == ContactGroup.id)
        .where(ContactGroup.organization_id == actor.organization_id)
        .order_by(ContactGroup.sort_order.asc(), ContactGroup.name.asc(), ContactGroup.created_at.asc())
    )
    if not include_archived:
        stmt = stmt.where(ContactGroup.status != "archived")
    if kind:
        stmt = stmt.where(ContactGroup.kind == kind)
    if not include_empty:
        stmt = stmt.where(func.coalesce(counts.c.member_count, 0) > 0)
    rows = db.execute(stmt).all()
    team_ids = actor_contact_team_ids(db, actor)
    return [
        serialize_contact_group(db, group, member_count=member_count, active_member_count=active_member_count)
        for group, member_count, active_member_count in rows
        if can_read_contact_group(actor, group, team_ids)
    ]


def serialize_contact_group(
    db: Session,
    group: ContactGroup,
    *,
    member_count: int | None = None,
    active_member_count: int | None = None,
) -> dict[str, Any]:
    if member_count is None or active_member_count is None:
        member_count, active_member_count = db.execute(
            select(
                func.count(ContactGroupMember.id),
                func.sum(case((Party.status == "active", 1), else_=0)),
            )
            .select_from(ContactGroupMember)
            .join(
                Party,
                and_(
                    Party.id == ContactGroupMember.party_id,
                    Party.organization_id == ContactGroupMember.organization_id,
                ),
            )
            .where(
                ContactGroupMember.organization_id == group.organization_id,
                ContactGroupMember.group_id == group.id,
            )
        ).one()
    data = row_dict(group)
    data["member_count"] = int(member_count or 0)
    data["active_member_count"] = int(active_member_count or 0)
    return data


def readable_group_party_ids(db: Session, actor: Actor, group_id: str) -> set[str]:
    group = get_contact_group_or_error(db, actor, group_id)
    if group.status == "archived":
        return set()
    allowed = readable_party_filter(actor, db)
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
    team_ids = actor_contact_team_ids(db, actor)
    for group, member in rows:
        if not can_read_contact_group(actor, group, team_ids):
            continue
        result.append({
            "id": group.id,
            "name": group.name,
            "description": group.description,
            "kind": group.kind,
            "visibility_scope": group.visibility_scope,
            "status": group.status,
            "member_id": member.id,
            "created_at": member.created_at,
        })
    return result

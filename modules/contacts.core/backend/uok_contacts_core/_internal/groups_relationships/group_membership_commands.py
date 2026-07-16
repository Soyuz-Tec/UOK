from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok_contacts_core._internal.delivery.command_support import _emit_event, _party
from uok_contacts_core._internal.groups_relationships.group_read_model import (
    ensure_manually_managed_contact_group,
    get_contact_group_or_error,
    serialize_contact_group,
)
from uok_contacts_core._internal.persistence.models import ContactGroupMember, utcnow
from uok_contacts_core._internal.registry.validation import bounded_text, validate_contact_payload_lengths
from uok.kernel.security import Actor
from uok.util import dumps


def cmd_add_contacts_to_group(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    validate_contact_payload_lengths(payload)
    group = get_contact_group_or_error(db, actor, bounded_text(payload.get("group_id"), "group_id"))
    ensure_manually_managed_contact_group(group)
    if group.status == "archived":
        raise ValueError("archived contact groups cannot be edited")
    party_ids = _party_ids(payload)
    existing_party_ids = set(db.scalars(select(ContactGroupMember.party_id).where(
        ContactGroupMember.organization_id == actor.organization_id,
        ContactGroupMember.group_id == group.id,
        ContactGroupMember.party_id.in_(party_ids),
    )).all())
    added_count = 0
    for party_id in party_ids:
        party = _party(db, actor, party_id, "party_id")
        if party.id in existing_party_ids:
            continue
        db.add(ContactGroupMember(
            organization_id=actor.organization_id,
            group_id=group.id,
            party_id=party.id,
            added_by_user_id=actor.user_id,
            attrs_json=dumps({}),
            created_at=utcnow(),
        ))
        added_count += 1
    if added_count:
        group.updated_at = utcnow()
        db.flush()
        _emit_event(db, actor, "ContactAddedToGroup", "ContactGroup", group.id, {
            "name": group.name,
            "added_count": added_count,
        })
    return {"group": serialize_contact_group(db, group), "added_count": added_count}


def cmd_remove_contact_from_group(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    validate_contact_payload_lengths(payload)
    group = get_contact_group_or_error(db, actor, bounded_text(payload.get("group_id"), "group_id"))
    ensure_manually_managed_contact_group(group)
    if group.status == "archived":
        raise ValueError("archived contact groups cannot be edited")
    party = _party(db, actor, bounded_text(payload.get("party_id"), "party_id"), "party_id")
    rows = db.scalars(select(ContactGroupMember).where(
        ContactGroupMember.organization_id == actor.organization_id,
        ContactGroupMember.group_id == group.id,
        ContactGroupMember.party_id == party.id,
    )).all()
    for row in rows:
        db.delete(row)
    if rows:
        group.updated_at = utcnow()
        _emit_event(db, actor, "ContactRemovedFromGroup", "ContactGroup", group.id, {
            "name": group.name,
            "party_id": party.id,
            "removed_count": len(rows),
        })
    return {"group": serialize_contact_group(db, group), "removed_count": len(rows)}


def _party_ids(payload: dict[str, Any]) -> list[str]:
    raw = payload.get("party_ids")
    if raw is None and payload.get("party_id"):
        raw = [payload.get("party_id")]
    if not isinstance(raw, list) or not raw:
        raise ValueError("party_ids is required")
    result: list[str] = []
    for value in raw:
        party_id = bounded_text(value, "party_id")
        if party_id and party_id not in result:
            result.append(party_id)
    if not result:
        raise ValueError("party_ids is required")
    if len(result) > 200:
        raise ValueError("party_ids must contain 200 contacts or fewer")
    return result

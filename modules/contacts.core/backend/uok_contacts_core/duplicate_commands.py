from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .command_support import _emit_event, _party
from .facade import CONTACT_ATTR_FIELDS, bounded_text, serialize_party, touch_party
from .models import ContactGroupMember, Party, PartyNote, PartyRelationship, utcnow
from uok.security import Actor
from uok.util import dumps, loads


def cmd_merge_duplicate_contact(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    primary = _party(db, actor, bounded_text(payload.get("primary_party_id"), "party_id"), "primary_party_id")
    duplicate = _party(db, actor, bounded_text(payload.get("duplicate_party_id"), "party_id"), "duplicate_party_id")
    if primary.id == duplicate.id:
        raise ValueError("primary_party_id and duplicate_party_id must be different")
    if primary.status == "purged" or duplicate.status == "purged":
        raise ValueError("purged contacts cannot be merged")

    primary_attrs = _merged_attrs(primary, duplicate)
    duplicate_attrs = loads(duplicate.attrs_json, {})
    duplicate_attrs.update({
        "merged_into_party_id": primary.id,
        "merged_into_display_name": primary.display_name,
    })
    primary.attrs_json = dumps(primary_attrs)
    duplicate.attrs_json = dumps(duplicate_attrs)

    moved_notes = _move_notes(db, actor, primary, duplicate)
    moved_groups = _move_group_memberships(db, actor, primary, duplicate)
    moved_relationships = _move_relationships(db, actor, primary, duplicate)

    duplicate.status = "archived"
    duplicate.review_state = "ready"
    duplicate.archived_at = duplicate.archived_at or utcnow()
    primary.review_state = "ready" if not primary_attrs.get("duplicate_candidates") else primary.review_state
    touch_party(primary)
    touch_party(duplicate)
    db.flush()

    _emit_event(db, actor, "ContactDuplicateMerged", "Party", primary.id, {
        "primary_party_id": primary.id,
        "primary_display_name": primary.display_name,
        "duplicate_party_id": duplicate.id,
        "duplicate_display_name": duplicate.display_name,
        "moved_notes": moved_notes,
        "moved_groups": moved_groups,
        "moved_relationships": moved_relationships,
    })
    result = serialize_party(db, primary, include_detail=True, actor=actor)
    result.update({
        "contact_id": primary.id,
        "merged_duplicate_id": duplicate.id,
        "moved_notes": moved_notes,
        "moved_groups": moved_groups,
        "moved_relationships": moved_relationships,
    })
    return result


def _merged_attrs(primary: Party, duplicate: Party) -> dict[str, Any]:
    primary_attrs = loads(primary.attrs_json, {})
    duplicate_attrs = loads(duplicate.attrs_json, {})
    for field in CONTACT_ATTR_FIELDS:
        if not primary_attrs.get(field) and duplicate_attrs.get(field):
            primary_attrs[field] = duplicate_attrs[field]
    merged_from = list(primary_attrs.get("merged_duplicate_ids") or [])
    if duplicate.id not in merged_from:
        merged_from.append(duplicate.id)
    primary_attrs["merged_duplicate_ids"] = merged_from
    primary_attrs["merged_duplicate_names"] = _unique_texts([
        *list(primary_attrs.get("merged_duplicate_names") or []),
        duplicate.display_name,
    ])
    primary_attrs["duplicate_candidates"] = _remaining_duplicate_candidates(primary_attrs, duplicate.id, primary.id)
    return primary_attrs


def _remaining_duplicate_candidates(attrs: dict[str, Any], duplicate_id: str, primary_id: str) -> list[dict[str, Any]]:
    candidates = attrs.get("duplicate_candidates")
    if not isinstance(candidates, list):
        return []
    return [
        row for row in candidates
        if isinstance(row, dict) and row.get("id") not in {duplicate_id, primary_id}
    ]


def _move_notes(db: Session, actor: Actor, primary: Party, duplicate: Party) -> int:
    notes = db.scalars(select(PartyNote).where(
        PartyNote.organization_id == actor.organization_id,
        PartyNote.party_id == duplicate.id,
    )).all()
    for note in notes:
        note.party_id = primary.id
    return len(notes)


def _move_group_memberships(db: Session, actor: Actor, primary: Party, duplicate: Party) -> int:
    memberships = db.scalars(select(ContactGroupMember).where(
        ContactGroupMember.organization_id == actor.organization_id,
        ContactGroupMember.party_id == duplicate.id,
    )).all()
    moved = 0
    for membership in memberships:
        existing = db.scalar(select(ContactGroupMember).where(
            ContactGroupMember.organization_id == actor.organization_id,
            ContactGroupMember.group_id == membership.group_id,
            ContactGroupMember.party_id == primary.id,
        ))
        if existing:
            db.delete(membership)
            continue
        membership.party_id = primary.id
        moved += 1
    return moved


def _move_relationships(db: Session, actor: Actor, primary: Party, duplicate: Party) -> int:
    relationships = db.scalars(select(PartyRelationship).where(
        PartyRelationship.organization_id == actor.organization_id,
        (PartyRelationship.from_party_id == duplicate.id) | (PartyRelationship.to_party_id == duplicate.id),
    )).all()
    moved = 0
    for relationship in relationships:
        next_from = primary.id if relationship.from_party_id == duplicate.id else relationship.from_party_id
        next_to = primary.id if relationship.to_party_id == duplicate.id else relationship.to_party_id
        if next_from == next_to or _same_relationship_exists(db, actor, relationship, next_from, next_to):
            db.delete(relationship)
            continue
        relationship.from_party_id = next_from
        relationship.to_party_id = next_to
        moved += 1
    return moved


def _same_relationship_exists(
    db: Session,
    actor: Actor,
    relationship: PartyRelationship,
    from_party_id: str,
    to_party_id: str,
) -> bool:
    return db.scalar(select(PartyRelationship).where(
        PartyRelationship.organization_id == actor.organization_id,
        PartyRelationship.id != relationship.id,
        PartyRelationship.from_party_id == from_party_id,
        PartyRelationship.to_party_id == to_party_id,
        PartyRelationship.relationship_type == relationship.relationship_type,
    )) is not None


def _unique_texts(values: list[Any]) -> list[str]:
    result: list[str] = []
    for value in values:
        text = str(value or "").strip()
        if text and text not in result:
            result.append(text)
    return result

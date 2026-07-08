from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .facade import CONTACT_ATTR_FIELDS
from .models import ContactGroupMember, Party, PartyNote, PartyRelationship, utcnow
from uok.security import Actor
from uok.util import loads

VALID_FIELD_CHOICES = {"primary", "duplicate"}


def field_choices(value: Any) -> dict[str, str]:
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise ValueError("field_choices must be an object")
    choices: dict[str, str] = {}
    for field, choice in value.items():
        field_name = str(field or "").strip()
        choice_name = str(choice or "").strip()
        if field_name not in CONTACT_ATTR_FIELDS:
            raise ValueError(f"field_choices contains unsupported field: {field_name}")
        if choice_name not in VALID_FIELD_CHOICES:
            raise ValueError("field_choices values must be primary or duplicate")
        choices[field_name] = choice_name
    return choices


def merged_attrs(primary: Party, duplicate: Party, choices: dict[str, str]) -> dict[str, Any]:
    primary_attrs = loads(primary.attrs_json, {})
    duplicate_attrs = loads(duplicate.attrs_json, {})
    for field in CONTACT_ATTR_FIELDS:
        if choices.get(field) == "duplicate" and duplicate_attrs.get(field):
            primary_attrs[field] = duplicate_attrs[field]
        elif not primary_attrs.get(field) and duplicate_attrs.get(field):
            primary_attrs[field] = duplicate_attrs[field]
    merged_from = list(primary_attrs.get("merged_duplicate_ids") or [])
    if duplicate.id not in merged_from:
        merged_from.append(duplicate.id)
    primary_attrs["merged_duplicate_ids"] = merged_from
    primary_attrs["merged_duplicate_names"] = unique_texts([
        *list(primary_attrs.get("merged_duplicate_names") or []),
        duplicate.display_name,
    ])
    primary_attrs["duplicate_candidates"] = remaining_duplicate_candidates(primary_attrs, duplicate.id, primary.id)
    return primary_attrs


def record_merge_history(
    attrs: dict[str, Any],
    *,
    merge_id: str,
    primary: Party,
    duplicate: Party,
    primary_attrs_before: dict[str, Any],
    duplicate_attrs_before: dict[str, Any],
    choices: dict[str, str],
    notes: list[dict[str, Any]],
    groups: list[dict[str, Any]],
    relationships: list[dict[str, Any]],
) -> None:
    history = list(attrs.get("merge_history") or [])
    history.append({
        "merge_id": merge_id,
        "primary_party_id": primary.id,
        "duplicate_party_id": duplicate.id,
        "duplicate_display_name": duplicate.display_name,
        "primary_attrs_before": primary_attrs_before,
        "primary_review_state_before": primary.review_state,
        "duplicate_attrs_before": duplicate_attrs_before,
        "duplicate_status_before": duplicate.status,
        "duplicate_review_state_before": duplicate.review_state,
        "duplicate_archived_at_before": iso_or_none(duplicate.archived_at),
        "field_choices": choices,
        "notes": notes,
        "groups": groups,
        "relationships": relationships,
        "merged_at": iso_or_none(utcnow()),
    })
    attrs["merge_history"] = history


def remaining_duplicate_candidates(attrs: dict[str, Any], duplicate_id: str, primary_id: str) -> list[dict[str, Any]]:
    candidates = attrs.get("duplicate_candidates")
    if not isinstance(candidates, list):
        return []
    return [
        row for row in candidates
        if isinstance(row, dict) and row.get("id") not in {duplicate_id, primary_id}
    ]


def move_notes(db: Session, actor: Actor, primary: Party, duplicate: Party) -> list[dict[str, Any]]:
    notes = db.scalars(select(PartyNote).where(
        PartyNote.organization_id == actor.organization_id,
        PartyNote.party_id == duplicate.id,
    )).all()
    snapshots: list[dict[str, Any]] = []
    for note in notes:
        snapshots.append({"id": note.id})
        note.party_id = primary.id
    return snapshots


def move_group_memberships(db: Session, actor: Actor, primary: Party, duplicate: Party) -> list[dict[str, Any]]:
    memberships = db.scalars(select(ContactGroupMember).where(
        ContactGroupMember.organization_id == actor.organization_id,
        ContactGroupMember.party_id == duplicate.id,
    )).all()
    snapshots: list[dict[str, Any]] = []
    for membership in memberships:
        snapshots.append(group_snapshot(membership))
        existing = db.scalar(select(ContactGroupMember).where(
            ContactGroupMember.organization_id == actor.organization_id,
            ContactGroupMember.group_id == membership.group_id,
            ContactGroupMember.party_id == primary.id,
        ))
        if existing:
            db.delete(membership)
            continue
        membership.party_id = primary.id
    return snapshots


def move_relationships(db: Session, actor: Actor, primary: Party, duplicate: Party) -> list[dict[str, Any]]:
    relationships = db.scalars(select(PartyRelationship).where(
        PartyRelationship.organization_id == actor.organization_id,
        (PartyRelationship.from_party_id == duplicate.id) | (PartyRelationship.to_party_id == duplicate.id),
    )).all()
    snapshots: list[dict[str, Any]] = []
    for relationship in relationships:
        snapshots.append(relationship_snapshot(relationship))
        next_from = primary.id if relationship.from_party_id == duplicate.id else relationship.from_party_id
        next_to = primary.id if relationship.to_party_id == duplicate.id else relationship.to_party_id
        if next_from == next_to or same_relationship_exists(db, actor, relationship, next_from, next_to):
            db.delete(relationship)
            continue
        relationship.from_party_id = next_from
        relationship.to_party_id = next_to
    return snapshots


def rollback_notes(db: Session, actor: Actor, primary: Party, duplicate: Party, notes: list[dict[str, Any]]) -> None:
    for item in notes:
        note = db.get(PartyNote, item.get("id"))
        if note and note.organization_id == actor.organization_id and note.party_id == primary.id:
            note.party_id = duplicate.id


def rollback_groups(db: Session, actor: Actor, primary: Party, duplicate: Party, groups: list[dict[str, Any]]) -> None:
    for item in groups:
        membership = db.get(ContactGroupMember, item.get("id"))
        if membership and membership.organization_id == actor.organization_id and membership.party_id == primary.id:
            membership.party_id = duplicate.id
            continue
        if membership:
            continue
        existing = db.scalar(select(ContactGroupMember).where(
            ContactGroupMember.organization_id == actor.organization_id,
            ContactGroupMember.group_id == item.get("group_id"),
            ContactGroupMember.party_id == duplicate.id,
        ))
        if not existing:
            db.add(ContactGroupMember(
                id=item.get("id"),
                organization_id=item.get("organization_id"),
                group_id=item.get("group_id"),
                party_id=duplicate.id,
                added_by_user_id=item.get("added_by_user_id"),
                attrs_json=item.get("attrs_json") or "{}",
                created_at=datetime_or_none(item.get("created_at")) or utcnow(),
            ))


def rollback_relationships(db: Session, actor: Actor, relationships: list[dict[str, Any]]) -> None:
    for item in relationships:
        relationship = db.get(PartyRelationship, item.get("id"))
        if relationship and relationship.organization_id == actor.organization_id:
            relationship.from_party_id = item.get("from_party_id") or relationship.from_party_id
            relationship.to_party_id = item.get("to_party_id") or relationship.to_party_id
            relationship.relationship_type = item.get("relationship_type") or relationship.relationship_type
            continue
        existing = db.scalar(select(PartyRelationship).where(
            PartyRelationship.organization_id == actor.organization_id,
            PartyRelationship.from_party_id == item.get("from_party_id"),
            PartyRelationship.to_party_id == item.get("to_party_id"),
            PartyRelationship.relationship_type == item.get("relationship_type"),
        ))
        if not existing:
            db.add(PartyRelationship(
                id=item.get("id"),
                organization_id=item.get("organization_id"),
                from_party_id=item.get("from_party_id"),
                to_party_id=item.get("to_party_id"),
                relationship_type=item.get("relationship_type"),
                attrs_json=item.get("attrs_json") or "{}",
                created_at=datetime_or_none(item.get("created_at")) or utcnow(),
            ))


def same_relationship_exists(
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


def merge_snapshot(attrs: dict[str, Any], primary_id: str, duplicate_id: str, merge_id: str) -> dict[str, Any] | None:
    for item in reversed(list(attrs.get("merge_history") or [])):
        if not isinstance(item, dict):
            continue
        if item.get("primary_party_id") != primary_id or item.get("duplicate_party_id") != duplicate_id:
            continue
        if item.get("rolled_back_at"):
            continue
        if merge_id and item.get("merge_id") != merge_id:
            continue
        return item
    return None


def restore_primary_merge_attrs(attrs: dict[str, Any], snapshot: dict[str, Any]) -> None:
    before = snapshot.get("primary_attrs_before") or {}
    for field in CONTACT_ATTR_FIELDS:
        if field in before:
            attrs[field] = before[field]
        else:
            attrs.pop(field, None)
    duplicate_id = snapshot.get("duplicate_party_id")
    attrs["merged_duplicate_ids"] = [value for value in list(attrs.get("merged_duplicate_ids") or []) if value != duplicate_id]
    attrs["merged_duplicate_names"] = [
        value for value in list(attrs.get("merged_duplicate_names") or [])
        if value != snapshot.get("duplicate_display_name")
    ]


def mark_snapshot_rolled_back(attrs: dict[str, Any], snapshot: dict[str, Any], command_id: str) -> None:
    for item in list(attrs.get("merge_history") or []):
        if isinstance(item, dict) and item.get("merge_id") == snapshot.get("merge_id"):
            item["rolled_back_at"] = iso_or_none(utcnow())
            item["rollback_command_id"] = command_id


def group_snapshot(row: ContactGroupMember) -> dict[str, Any]:
    return {
        "id": row.id,
        "organization_id": row.organization_id,
        "group_id": row.group_id,
        "party_id": row.party_id,
        "added_by_user_id": row.added_by_user_id,
        "attrs_json": row.attrs_json,
        "created_at": iso_or_none(row.created_at),
    }


def relationship_snapshot(row: PartyRelationship) -> dict[str, Any]:
    return {
        "id": row.id,
        "organization_id": row.organization_id,
        "from_party_id": row.from_party_id,
        "to_party_id": row.to_party_id,
        "relationship_type": row.relationship_type,
        "attrs_json": row.attrs_json,
        "created_at": iso_or_none(row.created_at),
    }


def datetime_or_none(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value))


def iso_or_none(value: Any) -> str | None:
    return value.isoformat() if hasattr(value, "isoformat") else None


def unique_texts(values: list[Any]) -> list[str]:
    result: list[str] = []
    for value in values:
        text = str(value or "").strip()
        if text and text not in result:
            result.append(text)
    return result

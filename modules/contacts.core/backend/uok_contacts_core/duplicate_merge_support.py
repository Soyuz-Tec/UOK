from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .facade import CONTACT_ATTR_FIELDS
from .duplicate_merge_history import (
    group_snapshot,
    iso_or_none,
    relationship_snapshot,
    unique_texts,
)
from .models import ContactGroupMember, Party, PartyNote, PartyRelationship, utcnow
from .system_models import (
    ContactActivity,
    ContactConsentRecord,
    ContactExternalIdentity,
    ContactImportRow,
    PartyCustomFieldValue,
    PartyFact,
)
from uok.security import Actor
from uok.util import loads

VALID_FIELD_CHOICES = {"primary", "duplicate"}
PUBLIC_MERGE_HISTORY_FIELDS = {
    "merge_id",
    "primary_party_id",
    "duplicate_party_id",
    "merged_at",
    "rolled_back_at",
}


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
    governed_records: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:
    merged_at = iso_or_none(utcnow())
    history = [
        {key: value for key, value in item.items() if key in PUBLIC_MERGE_HISTORY_FIELDS}
        for item in list(attrs.get("merge_history") or [])
        if isinstance(item, dict)
    ]
    history.append({
        "merge_id": merge_id,
        "primary_party_id": primary.id,
        "duplicate_party_id": duplicate.id,
        "merged_at": merged_at,
    })
    attrs["merge_history"] = history
    return {
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
        "governed_records": governed_records,
        "merged_at": merged_at,
    }


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


def move_governed_records(db: Session, actor: Actor, primary: Party, duplicate: Party) -> dict[str, list[dict[str, Any]]]:
    moved: dict[str, list[dict[str, Any]]] = {
        "activities": [],
        "consents": [],
        "custom_values": [],
        "external_identities": [],
        "facts": [],
        "import_rows": [],
    }
    facts = db.scalars(select(PartyFact).where(
        PartyFact.organization_id == actor.organization_id,
        PartyFact.party_id == duplicate.id,
    )).all()
    for row in facts:
        conflict = db.scalar(select(PartyFact.id).where(
            PartyFact.organization_id == actor.organization_id,
            PartyFact.party_id == primary.id,
            PartyFact.fact_type == row.fact_type,
            PartyFact.label == row.label,
            PartyFact.normalized_value == row.normalized_value,
        ))
        if conflict:
            continue
        moved["facts"].append({"id": row.id})
        row.party_id = primary.id
    custom_values = db.scalars(select(PartyCustomFieldValue).where(
        PartyCustomFieldValue.organization_id == actor.organization_id,
        PartyCustomFieldValue.party_id == duplicate.id,
    )).all()
    for row in custom_values:
        conflict = db.scalar(select(PartyCustomFieldValue.id).where(
            PartyCustomFieldValue.organization_id == actor.organization_id,
            PartyCustomFieldValue.party_id == primary.id,
            PartyCustomFieldValue.field_definition_id == row.field_definition_id,
        ))
        if conflict:
            continue
        moved["custom_values"].append({"id": row.id})
        row.party_id = primary.id
    for key, model in (
        ("activities", ContactActivity),
        ("consents", ContactConsentRecord),
        ("external_identities", ContactExternalIdentity),
    ):
        rows = db.scalars(select(model).where(model.organization_id == actor.organization_id, model.party_id == duplicate.id)).all()
        for row in rows:
            moved[key].append({"id": row.id})
            row.party_id = primary.id
    import_rows = db.scalars(select(ContactImportRow).where(
        ContactImportRow.organization_id == actor.organization_id,
        (ContactImportRow.party_id == duplicate.id) | (ContactImportRow.matched_party_id == duplicate.id),
    )).all()
    for row in import_rows:
        snapshot = {"id": row.id, "party_id": row.party_id, "matched_party_id": row.matched_party_id}
        moved["import_rows"].append(snapshot)
        if row.party_id == duplicate.id:
            row.party_id = primary.id
        if row.matched_party_id == duplicate.id:
            row.matched_party_id = primary.id
    return moved


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

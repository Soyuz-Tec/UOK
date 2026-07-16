from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok.kernel.security import Actor

from uok_contacts_core._internal.exchange_quality.duplicate_merge_history import datetime_or_none
from uok_contacts_core._internal.persistence.models import ContactGroupMember, Party, PartyNote, PartyRelationship, utcnow
from uok_contacts_core._internal.persistence.system_models import (
    ContactActivity,
    ContactConsentRecord,
    ContactExternalIdentity,
    ContactImportRow,
    PartyCustomFieldValue,
    PartyFact,
)


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


def rollback_governed_records(
    db: Session,
    actor: Actor,
    primary: Party,
    duplicate: Party,
    records: dict[str, list[dict[str, Any]]],
) -> None:
    for key, model in (
        ("activities", ContactActivity),
        ("consents", ContactConsentRecord),
        ("custom_values", PartyCustomFieldValue),
        ("external_identities", ContactExternalIdentity),
        ("facts", PartyFact),
    ):
        for item in records.get(key, []):
            row = db.get(model, item.get("id"))
            if row and row.organization_id == actor.organization_id and row.party_id == primary.id:
                row.party_id = duplicate.id
    for item in records.get("import_rows", []):
        row = db.get(ContactImportRow, item.get("id"))
        if not row or row.organization_id != actor.organization_id:
            continue
        row.party_id = item.get("party_id")
        row.matched_party_id = item.get("matched_party_id")

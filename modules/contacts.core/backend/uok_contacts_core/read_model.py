from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .access import readable_note_records, readable_party_filter, readable_relationship_records, relationship_is_readable
from .models import ContactImportBatch, Party, PartyNote, PartyRelationship, utcnow
from .profile_service import business_profile_summary
from .validation import CONTACT_ATTR_FIELDS
from uok.security import Actor
from uok.util import loads, row_dict


def _party_attrs(party: Party) -> dict[str, Any]:
    return loads(party.attrs_json, {})


def _party_search_text(party: Party, notes: list[PartyNote] | None = None, relationships: list[PartyRelationship] | None = None) -> str:
    attrs = _party_attrs(party)
    parts = [party.display_name, party.party_type, party.status, party.review_state, party.source]
    parts.extend(str(attrs.get(field, "")) for field in CONTACT_ATTR_FIELDS)
    profile = business_profile_summary(party)
    parts.extend([
        profile.get("summary", ""),
        " ".join(profile.get("tags", [])),
        " ".join(profile.get("risk_flags", [])),
    ])
    for note in notes or []:
        parts.append(note.body)
    for relationship in relationships or []:
        parts.append(relationship.relationship_type)
    return " ".join(parts).lower()


def list_parties(
    db: Session,
    actor: Actor,
    query: str = "",
    status: str = "active",
    review_state: str = "",
    party_type: str = "",
    limit: int = 200,
) -> list[dict[str, Any]]:
    rows = list(db.scalars(
        select(Party)
        .where(Party.organization_id == actor.organization_id)
        .order_by(Party.updated_at.desc(), Party.created_at.desc())
        .limit(max(1, min(limit, 500)))
    ).all())
    allowed = readable_party_filter(actor)
    query_value = query.lower().strip()
    result: list[dict[str, Any]] = []
    for party in rows:
        if not _party_matches_filters(party, allowed, status, review_state, party_type):
            continue
        notes = readable_note_records(db, party.id, actor)
        relationships = readable_relationship_records(db, actor, party.id, allowed)
        if query_value and query_value not in _party_search_text(party, notes, relationships):
            continue
        result.append(serialize_party(db, party))
    return result


def _party_matches_filters(party: Party, allowed, status: str, review_state: str, party_type: str) -> bool:
    if not allowed(party):
        return False
    if status and status != "all" and party.status != status:
        return False
    if review_state and review_state != "all" and party.review_state != review_state:
        return False
    return not (party_type and party_type != "all" and party.party_type != party_type)


def review_queue(db: Session, actor: Actor) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(Party)
        .where(
            Party.organization_id == actor.organization_id,
            Party.status != "purged",
            Party.review_state.in_(("needs_review", "possible_duplicate", "incomplete")),
        )
        .order_by(Party.updated_at.desc(), Party.created_at.desc())
    ).all()
    allowed = readable_party_filter(actor)
    return [serialize_party(db, row) for row in rows if allowed(row)]


def note_rows(db: Session, party_id: str, actor: Actor | None = None) -> list[dict[str, Any]]:
    return [row_dict(row) for row in readable_note_records(db, party_id, actor)]


def relationship_rows(db: Session, organization_id: str, party_id: str, actor: Actor | None = None) -> list[dict[str, Any]]:
    rows = db.scalars(select(PartyRelationship).where(
        PartyRelationship.organization_id == organization_id,
        (PartyRelationship.from_party_id == party_id) | (PartyRelationship.to_party_id == party_id),
    ).order_by(PartyRelationship.created_at.desc())).all()
    if actor is None:
        return [row_dict(row) for row in rows]
    allowed = readable_party_filter(actor)
    return [row_dict(row) for row in rows if relationship_is_readable(db, row, allowed)]


def import_batch_rows(db: Session, actor: Actor) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(ContactImportBatch)
        .where(ContactImportBatch.organization_id == actor.organization_id)
        .order_by(ContactImportBatch.created_at.desc())
        .limit(50)
    ).all()
    return [row_dict(row) for row in rows]


def serialize_party(db: Session, party: Party, include_detail: bool = False, actor: Actor | None = None) -> dict[str, Any]:
    data = row_dict(party)
    attrs = data.get("attrs", {})
    data.update({
        "email": attrs.get("email", ""),
        "phone": attrs.get("phone", ""),
        "website": attrs.get("website", ""),
        "address": attrs.get("address", ""),
        "given_name": attrs.get("given_name", ""),
        "family_name": attrs.get("family_name", ""),
        "organization_name": attrs.get("organization_name", ""),
        "title": attrs.get("title", ""),
        "duplicate_candidates": attrs.get("duplicate_candidates", []),
        "business_profile": business_profile_summary(party),
    })
    if include_detail:
        data["notes"] = note_rows(db, party.id, actor)
        data["relationships"] = relationship_rows(db, party.organization_id, party.id, actor)
    return data


def touch_party(party: Party) -> None:
    party.updated_at = utcnow()


def iso_or_none(value: datetime | None) -> str | None:
    return value.isoformat() if value else None

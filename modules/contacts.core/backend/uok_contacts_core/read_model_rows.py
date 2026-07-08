from __future__ import annotations

from datetime import datetime
from typing import Any, Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from .access import readable_note_records, readable_party_filter, relationship_is_readable
from .group_read_model import party_contact_group_rows
from .models import ContactImportBatch, Party, PartyRelationship, utcnow
from .validation import CONTACT_ATTR_FIELDS
from uok.security import Actor
from uok.util import loads, row_dict


def _party_attrs(party: Party) -> dict[str, Any]:
    return loads(party.attrs_json, {})


def note_rows(db: Session, party_id: str, actor: Actor | None = None) -> list[dict[str, Any]]:
    return [row_dict(row) for row in readable_note_records(db, party_id, actor)]


def relationship_rows(db: Session, organization_id: str, party_id: str, actor: Actor | None = None) -> list[dict[str, Any]]:
    rows = db.scalars(select(PartyRelationship).where(
        PartyRelationship.organization_id == organization_id,
        (PartyRelationship.from_party_id == party_id) | (PartyRelationship.to_party_id == party_id),
    ).order_by(PartyRelationship.created_at.desc())).all()
    if actor is None:
        return _unique_relationship_rows(_relationship_row(db, row, party_id) for row in rows)
    allowed = readable_party_filter(actor)
    return _unique_relationship_rows(_relationship_row(db, row, party_id) for row in rows if relationship_is_readable(db, row, allowed))


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
    data.update({field: attrs.get(field, "") for field in CONTACT_ATTR_FIELDS})
    data["duplicate_candidates"] = attrs.get("duplicate_candidates", [])
    data["business_intelligence_profile"] = business_intelligence_profile(
        party,
        attrs=attrs,
        notes=note_rows(db, party.id, actor) if include_detail else None,
        relationships=relationship_rows(db, party.organization_id, party.id, actor) if include_detail else None,
        groups=party_contact_group_rows(db, actor, party.id) if include_detail and actor else None,
    )
    if include_detail:
        data["notes"] = note_rows(db, party.id, actor)
        data["relationships"] = relationship_rows(db, party.organization_id, party.id, actor)
        data["groups"] = party_contact_group_rows(db, actor, party.id) if actor else []
    return data


def business_intelligence_profile(
    party: Party,
    *,
    attrs: dict[str, Any] | None = None,
    notes: list[dict[str, Any]] | None = None,
    relationships: list[dict[str, Any]] | None = None,
    groups: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    attrs = attrs or _party_attrs(party)
    notes = notes or []
    relationships = relationships or []
    groups = groups or []
    duplicate_candidates = attrs.get("duplicate_candidates", [])
    duplicate_candidate_count = len(duplicate_candidates) if isinstance(duplicate_candidates, list) else 0
    fact_count = _meaningful_fact_count(party, attrs)
    note_count = len(notes)
    relationship_count = len(relationships)
    group_count = len(groups)
    business_domain_group_count = sum(1 for group in groups if str(group.get("kind", "")) == "business_domain")
    imported = party.source in {"csv_import", "gmail", "email"}
    relationship_names = _unique_text_values(row.get("related_party_name", "") for row in relationships)
    group_names = _unique_text_values(row.get("name", "") for row in groups)
    tags = _unique_text_values([
        party.party_type,
        party.review_state,
        "imported" if imported else "",
        "duplicate_candidate" if duplicate_candidate_count else "",
        "relationship_linked" if relationship_count else "",
        "grouped" if group_count else "",
        "business_domain_grouped" if business_domain_group_count else "",
    ])
    risk_flags = _unique_text_values([
        "archived" if party.status == "archived" else "",
        "purged" if party.status == "purged" else "",
        "possible_duplicate" if party.review_state == "possible_duplicate" or duplicate_candidate_count else "",
        "needs_review" if party.review_state == "needs_review" else "",
        "incomplete" if party.review_state == "incomplete" or fact_count < 2 else "",
    ])
    readiness = _profile_readiness(party.status, party.review_state, fact_count, duplicate_candidate_count)
    confidence = _profile_confidence(party.status, party.review_state, fact_count, note_count, relationship_count, group_count, duplicate_candidate_count)
    headline = _profile_headline(readiness)
    summary = _profile_summary(party, fact_count, note_count, relationship_count, group_count, duplicate_candidate_count, imported)
    recent_note = notes[0].get("body", "") if notes else ""
    primary_organization_name = _primary_organization_name(party, attrs, relationships)
    signal_count = 1 + note_count + relationship_count + group_count + duplicate_candidate_count + (1 if imported else 0)
    return {
        "profile_type": party.party_type if party.party_type in {"person", "organization"} else "unknown",
        "headline": headline,
        "summary": summary,
        "confidence": confidence,
        "readiness": readiness,
        "signal_count": signal_count,
        "fact_count": fact_count,
        "note_count": note_count,
        "relationship_count": relationship_count,
        "group_count": group_count,
        "business_domain_group_count": business_domain_group_count,
        "duplicate_candidate_count": duplicate_candidate_count,
        "primary_organization_name": primary_organization_name,
        "recent_note": recent_note,
        "updated_at": data_value_or_none(party.updated_at),
        "tags": tags,
        "risk_flags": risk_flags,
        "group_names": group_names,
        "relationship_names": relationship_names,
    }


def _relationship_row(db: Session, row: PartyRelationship, selected_party_id: str) -> dict[str, Any]:
    related_party_id = row.to_party_id if row.from_party_id == selected_party_id else row.from_party_id
    related_party = db.get(Party, related_party_id)
    related_attrs = _party_attrs(related_party) if related_party else {}
    return row_dict(row, {
        "direction": "outbound" if row.from_party_id == selected_party_id else "inbound",
        "related_party_id": related_party_id,
        "related_party_name": related_party.display_name if related_party else "",
        "related_party_type": related_party.party_type if related_party else "",
        "related_party_email": related_attrs.get("email", ""),
        "related_party_phone": related_attrs.get("phone", ""),
    })


def _unique_relationship_rows(rows: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, str, str]] = set()
    result: list[dict[str, Any]] = []
    for row in rows:
        key = (
            str(row.get("direction", "")),
            str(row.get("relationship_type", "")),
            str(row.get("related_party_id", "")),
        )
        if key in seen:
            continue
        seen.add(key)
        result.append(row)
    return result


def touch_party(party: Party) -> None:
    party.updated_at = utcnow()


def iso_or_none(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def data_value_or_none(value: Any) -> str | None:
    return value.isoformat() if hasattr(value, "isoformat") else None


def _meaningful_fact_count(party: Party, attrs: dict[str, Any]) -> int:
    seen: set[str] = set()
    count = 0
    for value in [party.display_name, *[attrs.get(field) for field in CONTACT_ATTR_FIELDS], attrs.get("company_name")]:
        text = str(value or "").strip()
        if not text:
            continue
        key = text.casefold()
        if key in seen:
            continue
        seen.add(key)
        count += 1
    return count


def _primary_organization_name(party: Party, attrs: dict[str, Any], relationships: list[dict[str, Any]]) -> str:
    if party.party_type == "organization":
        return str(attrs.get("organization_name") or party.display_name or "").strip()
    for relationship in relationships:
        if relationship.get("relationship_type") == "works_for" and relationship.get("related_party_name"):
            return str(relationship.get("related_party_name", "")).strip()
    return str(attrs.get("organization_name") or attrs.get("company_name") or "").strip()


def _profile_readiness(status: str, review_state: str, fact_count: int, duplicate_candidate_count: int) -> str:
    if status == "purged":
        return "purged"
    if status == "archived":
        return "archived"
    if review_state == "possible_duplicate" or duplicate_candidate_count:
        return "possible_duplicate"
    if review_state in {"needs_review", "incomplete"}:
        return review_state
    if fact_count < 2:
        return "incomplete"
    return "ready"


def _profile_confidence(
    status: str,
    review_state: str,
    fact_count: int,
    note_count: int,
    relationship_count: int,
    group_count: int,
    duplicate_candidate_count: int,
) -> str:
    if status in {"archived", "purged"} or review_state == "possible_duplicate" or duplicate_candidate_count:
        return "low"
    supporting_signals = note_count + relationship_count + group_count
    if review_state in {"needs_review", "incomplete"}:
        return "medium"
    if fact_count >= 4 and supporting_signals >= 1:
        return "high"
    if fact_count >= 2:
        return "medium"
    return "low"


def _profile_headline(readiness: str) -> str:
    return {
        "ready": "Ready contact",
        "needs_review": "Needs review",
        "possible_duplicate": "Possible duplicate",
        "incomplete": "Incomplete contact",
        "archived": "Archived contact",
        "purged": "Purged contact",
    }.get(readiness, "Contact profile")


def _profile_summary(
    party: Party,
    fact_count: int,
    note_count: int,
    relationship_count: int,
    group_count: int,
    duplicate_candidate_count: int,
    imported: bool,
) -> str:
    if party.status == "purged":
        return "This contact has been purged."
    if party.status == "archived":
        return "This contact is archived."
    if duplicate_candidate_count:
        return "This record has duplicate signals that should be reviewed."
    if imported and party.review_state != "ready":
        return "Imported contact awaiting review."
    if party.review_state == "needs_review":
        return "This contact is waiting for review before it is fully trusted."
    if party.review_state == "incomplete" or fact_count < 2:
        return "Add another meaningful fact before relying on this record."
    pieces = [f"{fact_count} contact facts"]
    if note_count:
        pieces.append(f"{note_count} notes")
    if relationship_count:
        pieces.append(f"{relationship_count} relationships")
    if group_count:
        pieces.append(f"{group_count} groups")
    return "Ready contact with " + ", ".join(pieces) + "."


def _unique_text_values(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        text = str(value or "").strip()
        key = text.casefold()
        if not text or key in seen:
            continue
        seen.add(key)
        result.append(text)
    return result

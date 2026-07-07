from __future__ import annotations

from datetime import datetime
from typing import Any, Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from .access import readable_note_records, readable_party_filter, relationship_is_readable
from .group_read_model import party_contact_group_rows
from .models import ContactImportBatch, Party, PartyRelationship, utcnow
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
    })
    if include_detail:
        data["notes"] = note_rows(db, party.id, actor)
        data["relationships"] = relationship_rows(db, party.organization_id, party.id, actor)
        data["groups"] = party_contact_group_rows(db, actor, party.id) if actor else []
    return data


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

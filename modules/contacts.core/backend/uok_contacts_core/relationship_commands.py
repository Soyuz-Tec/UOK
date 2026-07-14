from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .command_support import _emit_event, _party
from .facade import bounded_text, serialize_party, touch_party, validate_contact_payload_lengths
from .models import PartyRelationship, utcnow
from uok.security import Actor
from uok.util import dumps, loads


def cmd_link_contact_relationship(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    validate_contact_payload_lengths(payload)
    from_party = _party(db, actor, bounded_text(payload.get("from_party_id"), "party_id"), "from_party_id")
    to_party = _party(db, actor, bounded_text(payload.get("to_party_id"), "party_id"), "to_party_id")
    relationship_type = bounded_text(payload.get("relationship_type"), "relationship_type")
    if not relationship_type:
        raise ValueError("relationship_type is required")
    if from_party.id == to_party.id:
        raise ValueError("a contact cannot have a relationship to itself")
    existing = db.scalar(select(PartyRelationship).where(
        PartyRelationship.organization_id == actor.organization_id,
        PartyRelationship.from_party_id == from_party.id,
        PartyRelationship.to_party_id == to_party.id,
        PartyRelationship.relationship_type == relationship_type,
    ))
    if existing:
        return {
            "relationship_id": existing.id,
            "from_party": serialize_party(db, from_party),
            "to_party": serialize_party(db, to_party),
            "already_linked": True,
        }
    rel = PartyRelationship(
        organization_id=actor.organization_id,
        from_party_id=from_party.id,
        to_party_id=to_party.id,
        relationship_type=relationship_type,
        attrs_json=dumps({"description": bounded_text(payload.get("description"), "description")}),
        created_at=utcnow(),
    )
    db.add(rel)
    touch_party(from_party)
    touch_party(to_party)
    db.flush()
    _emit_event(db, actor, "ContactRelationshipLinked", "PartyRelationship", rel.id, {
        "from_party_id": from_party.id,
        "to_party_id": to_party.id,
        "relationship_type": relationship_type,
    })
    return {"relationship_id": rel.id, "from_party": serialize_party(db, from_party), "to_party": serialize_party(db, to_party)}


def cmd_update_contact_relationship(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    validate_contact_payload_lengths(payload)
    rel = _relationship(db, actor, bounded_text(payload.get("relationship_id"), "relationship_id"))
    original_from_party = _party(db, actor, rel.from_party_id, "from_party_id")
    original_to_party = _party(db, actor, rel.to_party_id, "to_party_id")
    from_party = _party(db, actor, bounded_text(payload.get("from_party_id") or rel.from_party_id, "party_id"), "from_party_id")
    to_party = _party(db, actor, bounded_text(payload.get("to_party_id") or rel.to_party_id, "party_id"), "to_party_id")
    relationship_type = bounded_text(payload.get("relationship_type") or rel.relationship_type, "relationship_type")
    if not relationship_type:
        raise ValueError("relationship_type is required")
    if from_party.id == to_party.id:
        raise ValueError("a contact cannot have a relationship to itself")
    siblings = _duplicate_relationships(db, rel)
    sibling_ids = {row.id for row in siblings}
    duplicate_target = db.scalar(select(PartyRelationship.id).where(
        PartyRelationship.organization_id == actor.organization_id,
        PartyRelationship.from_party_id == from_party.id,
        PartyRelationship.to_party_id == to_party.id,
        PartyRelationship.relationship_type == relationship_type,
        PartyRelationship.id.not_in(sibling_ids),
    ))
    if duplicate_target:
        raise ValueError("contact relationship already exists")
    attrs = loads(rel.attrs_json, {})
    if "description" in payload:
        attrs["description"] = bounded_text(payload.get("description"), "description")
    for sibling in siblings:
        sibling.from_party_id = from_party.id
        sibling.to_party_id = to_party.id
        sibling.relationship_type = relationship_type
        sibling.attrs_json = dumps(attrs)
    touched_parties = {
        party.id: party
        for party in (original_from_party, original_to_party, from_party, to_party)
        if party is not None
    }
    for party in touched_parties.values():
        if party:
            touch_party(party)
    _emit_event(db, actor, "ContactRelationshipUpdated", "PartyRelationship", rel.id, {
        "relationship_id": rel.id,
        "from_party_id": from_party.id,
        "to_party_id": to_party.id,
        "relationship_type": relationship_type,
        "updated_count": len(siblings),
    })
    return {
        "relationship_id": rel.id,
        "from_party": serialize_party(db, from_party),
        "to_party": serialize_party(db, to_party),
        "updated_count": len(siblings),
    }


def cmd_remove_contact_relationship(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    validate_contact_payload_lengths(payload)
    rel = _relationship(db, actor, bounded_text(payload.get("relationship_id"), "relationship_id"))
    from_party = _party(db, actor, rel.from_party_id, "from_party_id")
    to_party = _party(db, actor, rel.to_party_id, "to_party_id")
    siblings = _duplicate_relationships(db, rel)
    for sibling in siblings:
        db.delete(sibling)
    touch_party(from_party)
    touch_party(to_party)
    _emit_event(db, actor, "ContactRelationshipRemoved", "PartyRelationship", rel.id, {
        "relationship_id": rel.id,
        "from_party_id": from_party.id,
        "to_party_id": to_party.id,
        "relationship_type": rel.relationship_type,
        "removed_count": len(siblings),
    })
    return {"relationship_id": rel.id, "removed_count": len(siblings)}


def _relationship(db: Session, actor: Actor, relationship_id: str) -> PartyRelationship:
    if not relationship_id:
        raise ValueError("relationship_id is required")
    rel = db.get(PartyRelationship, relationship_id)
    if not rel or rel.organization_id != actor.organization_id:
        raise ValueError("relationship not found")
    return rel


def _duplicate_relationships(db: Session, rel: PartyRelationship) -> list[PartyRelationship]:
    return list(db.scalars(select(PartyRelationship).where(
        PartyRelationship.organization_id == rel.organization_id,
        PartyRelationship.from_party_id == rel.from_party_id,
        PartyRelationship.to_party_id == rel.to_party_id,
        PartyRelationship.relationship_type == rel.relationship_type,
    )).all())

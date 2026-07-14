from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok.security import Actor
from uok.util import dumps, loads

from .command_support import _emit_event, _party
from .models import Party, utcnow
from .phone_numbers import normalize_phone
from .system_command_support import bounded_mapping, bounded_text, record_activity, serialize_fact
from .system_models import PartyFact

FACT_TYPES = {"address", "date", "email", "instant_message", "phone", "tag", "url"}


def cmd_upsert_contact_fact(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    party = _party(db, actor, bounded_text(payload.get("party_id"), 80), "party_id")
    if party.status == "purged":
        raise ValueError("purged contacts cannot receive facts")
    fact_type = bounded_text(payload.get("fact_type"), 40).lower()
    if fact_type not in FACT_TYPES:
        raise ValueError(f"fact_type must be one of: {', '.join(sorted(FACT_TYPES))}")
    label = bounded_text(payload.get("label") or "work", 60).lower()
    value = bounded_text(payload.get("value"), 4_000)
    if not value:
        raise ValueError("fact value is required")
    normalized = normalized_fact_value(fact_type, value)
    stored_value = normalized if fact_type == "phone" else value
    fact_id = bounded_text(payload.get("fact_id"), 80)
    fact = db.get(PartyFact, fact_id) if fact_id else None
    if fact and (fact.organization_id != actor.organization_id or fact.party_id != party.id):
        raise ValueError("contact fact not found")
    if not fact:
        fact = db.scalar(select(PartyFact).where(
            PartyFact.organization_id == actor.organization_id,
            PartyFact.party_id == party.id,
            PartyFact.fact_type == fact_type,
            PartyFact.label == label,
            PartyFact.normalized_value == normalized,
        ))
    previous_fact_type = fact.fact_type if fact else None
    previous_was_primary = bool(fact and fact.is_primary)
    now = utcnow()
    if not fact:
        fact = PartyFact(
            organization_id=actor.organization_id,
            party_id=party.id,
            fact_type=fact_type,
            label=label,
            value_text=value,
            normalized_value=normalized,
            created_by_user_id=actor.user_id,
            created_at=now,
            updated_at=now,
        )
        db.add(fact)
    fact.fact_type = fact_type
    fact.label = label
    fact.value_text = stored_value
    fact.normalized_value = normalized
    details = bounded_mapping(payload.get("details"))
    if stored_value != value:
        details = {**details, "source_value": value}
    fact.details_json = dumps(details)
    fact.is_primary = bool(payload.get("is_primary"))
    fact.is_verified = bool(payload.get("is_verified"))
    fact.source = bounded_text(payload.get("source") or "manual", 80)
    fact.confidence = bounded_text(payload.get("confidence") or "unknown", 40)
    fact.updated_at = now
    db.flush()
    if fact.is_primary or not _has_primary_fact(db, party.id, fact_type, fact.id):
        fact.is_primary = True
        _clear_other_primary_facts(db, party.id, fact_type, fact.id, now)
        db.flush()
    if previous_fact_type and previous_fact_type != fact_type and previous_was_primary:
        _promote_primary_fact(db, party.id, previous_fact_type)
        db.flush()
    for affected_fact_type in {fact_type, previous_fact_type} - {None}:
        _sync_legacy_fact_projection(db, party, affected_fact_type)
    record_activity(db, actor, party.id, "contact_fact_saved", "PartyFact", fact.id, f"{fact_type} fact saved", {"fact_type": fact_type, "label": label})
    _emit_event(db, actor, "ContactFactSaved", "PartyFact", fact.id, {"party_id": party.id, "fact_type": fact_type, "label": label})
    return serialize_fact(fact)


def cmd_remove_contact_fact(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    party = _party(db, actor, bounded_text(payload.get("party_id"), 80), "party_id")
    fact = db.get(PartyFact, bounded_text(payload.get("fact_id"), 80))
    if not fact or fact.organization_id != actor.organization_id or fact.party_id != party.id:
        raise ValueError("contact fact not found")
    fact_type, was_primary, fact_id = fact.fact_type, fact.is_primary, fact.id
    db.delete(fact)
    db.flush()
    if was_primary:
        _promote_primary_fact(db, party.id, fact_type)
        db.flush()
    _sync_legacy_fact_projection(db, party, fact_type)
    record_activity(db, actor, party.id, "contact_fact_removed", "PartyFact", fact_id, f"{fact_type} fact removed", {"fact_type": fact_type})
    _emit_event(db, actor, "ContactFactRemoved", "PartyFact", fact_id, {"party_id": party.id, "fact_type": fact_type})
    return {"fact_id": fact_id, "removed": True}


def normalized_fact_value(fact_type: str, value: str) -> str:
    cleaned = " ".join(str(value or "").strip().split())
    if not cleaned:
        return ""
    if fact_type == "phone":
        return normalize_phone(cleaned)
    if fact_type == "url":
        return cleaned.rstrip("/").casefold()
    return cleaned.casefold()


def sync_legacy_payload_facts(db: Session, actor: Actor, party: Party, payload: dict[str, Any]) -> None:
    field_specs = {
        "email": ("email", "work"), "phone": ("phone", "work"), "website": ("url", "work"),
        "address": ("address", "work"), "birthday": ("date", "birthday"),
        "important_date": ("date", "important"), "instant_message": ("instant_message", "work"),
    }
    for field, (fact_type, label) in field_specs.items():
        if field not in payload or not str(payload.get(field) or "").strip():
            continue
        cmd_upsert_contact_fact(db, actor, {
            "party_id": party.id, "fact_type": fact_type, "label": label,
            "value": payload[field], "is_primary": True,
            "source": payload.get("source") or party.source,
            "confidence": payload.get("confidence_level") or "unknown",
        }, "fact-projection")
    if "tags" in payload:
        _sync_tags(db, actor, party, payload)


def _sync_tags(db: Session, actor: Actor, party: Party, payload: dict[str, Any]) -> None:
    tags = payload.get("tags")
    values = tags if isinstance(tags, list) else str(tags or "").split(",")
    requested = {normalized_fact_value("tag", str(value)) for value in values if str(value).strip()}
    existing_tags = db.scalars(select(PartyFact).where(
        PartyFact.organization_id == actor.organization_id,
        PartyFact.party_id == party.id,
        PartyFact.fact_type == "tag",
    )).all()
    for existing in existing_tags:
        if existing.normalized_value not in requested:
            db.delete(existing)
    db.flush()
    for value in values:
        if str(value).strip():
            cmd_upsert_contact_fact(db, actor, {
                "party_id": party.id, "fact_type": "tag", "label": "tag",
                "value": str(value).strip(), "source": payload.get("source") or party.source,
            }, "fact-projection")


def _has_primary_fact(db: Session, party_id: str, fact_type: str, exclude_id: str) -> bool:
    return bool(db.scalar(select(PartyFact.id).where(
        PartyFact.party_id == party_id,
        PartyFact.fact_type == fact_type,
        PartyFact.is_primary.is_(True),
        PartyFact.id != exclude_id,
    )))


def _clear_other_primary_facts(db: Session, party_id: str, fact_type: str, fact_id: str, now: datetime) -> None:
    rows = db.scalars(select(PartyFact).where(
        PartyFact.party_id == party_id,
        PartyFact.fact_type == fact_type,
        PartyFact.id != fact_id,
        PartyFact.is_primary.is_(True),
    )).all()
    for row in rows:
        row.is_primary = False
        row.updated_at = now


def _promote_primary_fact(db: Session, party_id: str, fact_type: str) -> None:
    replacement = db.scalar(select(PartyFact).where(
        PartyFact.party_id == party_id,
        PartyFact.fact_type == fact_type,
    ).order_by(PartyFact.is_verified.desc(), PartyFact.created_at.asc()))
    if replacement:
        replacement.is_primary = True
        replacement.updated_at = utcnow()


def _sync_legacy_fact_projection(db: Session, party: Party, fact_type: str) -> None:
    attrs = loads(party.attrs_json, {})
    rows = list(db.scalars(select(PartyFact).where(
        PartyFact.organization_id == party.organization_id,
        PartyFact.party_id == party.id,
        PartyFact.fact_type == fact_type,
    ).order_by(PartyFact.is_primary.desc(), PartyFact.created_at.asc())).all())
    if fact_type == "tag":
        attrs["tags"] = ", ".join(dict.fromkeys(row.value_text for row in rows))
    elif fact_type == "date":
        attrs["birthday"] = ""
        attrs["important_date"] = ""
        for row in rows:
            field = "birthday" if row.label == "birthday" else "important_date"
            if not attrs[field]:
                attrs[field] = row.value_text
    else:
        primary = rows[0] if rows else None
        field = {"address": "address", "email": "email", "instant_message": "instant_message", "phone": "phone", "url": "website"}.get(fact_type)
        if field:
            attrs[field] = primary.value_text if primary else ""
    party.attrs_json = dumps(attrs)
    party.updated_at = utcnow()

from __future__ import annotations

from datetime import datetime
from hashlib import sha256
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok.security import Actor
from uok.util import dumps, loads

from .fact_commands import cmd_upsert_contact_fact, normalized_fact_value, sync_legacy_payload_facts
from .import_commands import AUTOMATED_MARKETING_TERMS
from .models import ContactImportBatch, Party, utcnow
from .system_command_support import row_checksum
from .system_models import ContactImportRow, PartyFact
from .validation import contact_attrs, review_state_for_payload

IMPORT_MODES = {"create", "update", "upsert"}
IMPORT_FIELDS = {
    "address", "company_name", "display_name", "email", "family_name", "given_name",
    "note", "organization_name", "party_type", "phone", "tags", "title", "website",
}


def new_batch(db: Session, actor: Actor, filename: str, status: str, attrs: dict[str, Any]) -> ContactImportBatch:
    batch = ContactImportBatch(
        organization_id=actor.organization_id,
        created_by_user_id=actor.user_id,
        source_filename=filename,
        status=status,
        attrs_json=dumps(attrs),
        created_at=utcnow(),
    )
    db.add(batch)
    db.flush()
    return batch


def validated_mapping(value: Any) -> dict[str, str]:
    if value in (None, ""):
        return {}
    if not isinstance(value, dict):
        raise ValueError("CSV mapping must be an object of target fields to source columns")
    mapping = {str(target).strip().lower(): str(source).strip() for target, source in value.items()}
    unknown = set(mapping) - IMPORT_FIELDS
    if unknown:
        raise ValueError(f"unsupported CSV mapping targets: {', '.join(sorted(unknown))}")
    return mapping


def mapped_row(row: dict[str, Any], mapping: dict[str, str]) -> dict[str, Any]:
    normalized = {str(key or "").strip().lower(): value for key, value in row.items() if key is not None}
    for target, source in mapping.items():
        normalized[target] = normalized.get(source.strip().lower(), "")
    return normalized


def find_import_match(db: Session, actor: Actor, payload: dict[str, Any]) -> Party | None:
    for fact_type in ("email", "phone"):
        normalized = normalized_fact_value(fact_type, str(payload.get(fact_type) or ""))
        if not normalized:
            continue
        fact = db.scalar(select(PartyFact).where(
            PartyFact.organization_id == actor.organization_id,
            PartyFact.fact_type == fact_type,
            PartyFact.normalized_value == normalized,
        ).limit(1))
        if fact:
            party = db.get(Party, fact.party_id)
            if party and party.status != "purged":
                return party
    email = normalized_fact_value("email", str(payload.get("email") or ""))
    phone = normalized_fact_value("phone", str(payload.get("phone") or ""))
    parties = db.scalars(select(Party).where(
        Party.organization_id == actor.organization_id,
        Party.status != "purged",
    )).all()
    for party in parties:
        attrs = loads(party.attrs_json, {})
        if email and normalized_fact_value("email", str(attrs.get("email") or "")) == email:
            return party
        if phone and normalized_fact_value("phone", str(attrs.get("phone") or "")) == phone:
            return party
    return None


def idempotent_import_party(db: Session, actor: Actor, checksum: str) -> Party | None:
    prior = db.scalar(select(ContactImportRow).where(
        ContactImportRow.organization_id == actor.organization_id,
        ContactImportRow.checksum == checksum,
        ContactImportRow.status == "applied",
        ContactImportRow.party_id.is_not(None),
    ).order_by(ContactImportRow.updated_at.desc()).limit(1))
    if not prior or not prior.party_id:
        return None
    party = db.get(Party, prior.party_id)
    return party if party and party.organization_id == actor.organization_id and party.status != "purged" else None


def resolved_operation(mode: str, match: Party | None) -> str:
    if mode == "create":
        if match:
            raise ValueError("matching contact already exists; use upsert or update mode")
        return "create"
    if mode == "update":
        if not match:
            raise ValueError("no matching contact found for update mode")
        return "update"
    return "update" if match else "create"


def update_imported_party(
    db: Session,
    actor: Actor,
    party: Party,
    payload: dict[str, Any],
    batch_id: str,
    filename: str,
    row_number: int,
) -> None:
    attrs = loads(party.attrs_json, {})
    attrs.update(contact_attrs(payload))
    attrs["source_evidence"] = {"batch_id": batch_id, "filename": filename, "row": row_number}
    party.attrs_json = dumps(attrs)
    if payload.get("display_name"):
        party.display_name = str(payload["display_name"]).strip()
    party.review_state = review_state_for_payload({**attrs, **payload}, [])
    party.source = "csv_import"
    party.updated_at = utcnow()
    sync_legacy_payload_facts(db, actor, party, payload)


def party_snapshot(db: Session, party: Party) -> dict[str, Any]:
    facts = db.scalars(select(PartyFact).where(
        PartyFact.organization_id == party.organization_id,
        PartyFact.party_id == party.id,
    ).order_by(
        PartyFact.fact_type.asc(),
        PartyFact.label.asc(),
        PartyFact.normalized_value.asc(),
    )).all()
    return {
        "attrs_json": party.attrs_json,
        "display_name": party.display_name,
        "review_state": party.review_state,
        "source": party.source,
        "status": party.status,
        "facts": [
            {
                "confidence": row.confidence,
                "created_at": row.created_at.isoformat(),
                "created_by_user_id": row.created_by_user_id,
                "details_json": row.details_json,
                "fact_type": row.fact_type,
                "is_primary": row.is_primary,
                "is_verified": row.is_verified,
                "label": row.label,
                "normalized_value": row.normalized_value,
                "source": row.source,
                "value_text": row.value_text,
            }
            for row in facts
        ],
    }


def party_snapshot_fingerprint(snapshot: dict[str, Any]) -> str:
    return sha256(dumps(snapshot).encode("utf-8")).hexdigest()


def restore_party_snapshot(db: Session, actor: Actor, party: Party, snapshot: dict[str, Any]) -> None:
    for field in ("attrs_json", "display_name", "review_state", "source", "status"):
        if field in snapshot:
            setattr(party, field, snapshot[field])
    for row in db.scalars(select(PartyFact).where(
        PartyFact.organization_id == actor.organization_id,
        PartyFact.party_id == party.id,
    )).all():
        db.delete(row)
    db.flush()
    for item in snapshot.get("facts", []):
        db.add(PartyFact(
            organization_id=actor.organization_id,
            party_id=party.id,
            fact_type=item["fact_type"],
            label=item["label"],
            value_text=item["value_text"],
            normalized_value=item["normalized_value"],
            details_json=item.get("details_json") or "{}",
            is_primary=bool(item.get("is_primary")),
            is_verified=bool(item.get("is_verified")),
            source=item.get("source") or "manual",
            confidence=item.get("confidence") or "unknown",
            created_by_user_id=item.get("created_by_user_id") or actor.user_id,
            created_at=datetime.fromisoformat(item["created_at"]),
            updated_at=utcnow(),
        ))
    db.flush()


def vcard_contact_payload(card: dict[str, Any], batch_id: str, row_number: int) -> dict[str, Any]:
    def first_value(key: str) -> str:
        return (card.get(key) or [{}])[0].get("value", "")

    return {
        "party_type": card.get("party_type") or "person",
        "display_name": card.get("display_name", ""),
        "organization_name": card.get("organization_name", ""),
        "email": first_value("emails"),
        "phone": first_value("phones"),
        "website": first_value("urls"),
        "address": first_value("addresses"),
        "title": card.get("title", ""),
        "birthday": card.get("birthday", ""),
        "note": card.get("note", ""),
        "tags": ", ".join(card.get("tags") or []),
        "source": "vcard",
        "client_reference": f"vcard:{str(card.get('external_id') or row_checksum(card))[:100]}",
        "import_batch_id": batch_id,
        "review_state": "needs_review",
    }


def add_vcard_facts(db: Session, actor: Actor, party: Party, card: dict[str, Any]) -> None:
    for fact_type, key in (("email", "emails"), ("phone", "phones"), ("url", "urls"), ("address", "addresses")):
        for index, item in enumerate(card.get(key) or []):
            cmd_upsert_contact_fact(db, actor, {
                "party_id": party.id,
                "fact_type": fact_type,
                "label": item.get("label") or "work",
                "value": item.get("value") or "",
                "is_primary": bool(item.get("is_primary")) or index == 0,
                "source": "vcard",
            }, "vcard-fact")


def import_error_code(message: str) -> str:
    lowered = message.lower()
    if any(term in lowered for term in AUTOMATED_MARKETING_TERMS):
        return "automated_marketing"
    if "matching contact" in lowered or "no matching contact" in lowered:
        return "match_policy"
    return "validation"

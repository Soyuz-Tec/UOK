from __future__ import annotations

from datetime import datetime
from typing import Any, Iterable

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from uok_contacts_core._internal.registry.access import readable_note_records, readable_party_filter, relationship_is_readable
from uok_contacts_core._internal.groups_relationships.group_read_model import party_contact_group_rows
from uok_contacts_core._internal.persistence.models import ContactImportBatch, Party, PartyRelationship, utcnow
from uok_contacts_core._internal.persistence.system_models import (
    ContactActivity,
    ContactConsentRecord,
    ContactExternalIdentity,
    PartyCustomFieldValue,
    PartyFact,
)
from uok_contacts_core._internal.registry.read_model_profile import business_intelligence_profile
from uok_contacts_core._internal.registry.validation import CONTACT_ATTR_FIELDS
from uok.kernel.security import Actor, has_permission
from uok.util import loads, row_dict

PUBLIC_MERGE_HISTORY_FIELDS = {
    "merge_id",
    "primary_party_id",
    "duplicate_party_id",
    "merged_at",
    "rolled_back_at",
}


def _party_attrs(party: Party) -> dict[str, Any]:
    return _public_party_attrs(loads(party.attrs_json, {}))


def _public_party_attrs(attrs: dict[str, Any]) -> dict[str, Any]:
    public_attrs = dict(attrs)
    if isinstance(attrs.get("merge_history"), list):
        public_attrs["merge_history"] = [
            {key: value for key, value in item.items() if key in PUBLIC_MERGE_HISTORY_FIELDS}
            for item in attrs["merge_history"]
            if isinstance(item, dict)
        ]
    return public_attrs


def note_rows(db: Session, party_id: str, actor: Actor | None = None) -> list[dict[str, Any]]:
    return [row_dict(row) for row in readable_note_records(db, party_id, actor)]


def relationship_rows(db: Session, organization_id: str, party_id: str, actor: Actor | None = None) -> list[dict[str, Any]]:
    rows = db.scalars(select(PartyRelationship).where(
        PartyRelationship.organization_id == organization_id,
        (PartyRelationship.from_party_id == party_id) | (PartyRelationship.to_party_id == party_id),
    ).order_by(PartyRelationship.created_at.desc())).all()
    if actor is None:
        return _unique_relationship_rows(_relationship_row(db, row, party_id) for row in rows)
    allowed = readable_party_filter(actor, db)
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
    attrs = _public_party_attrs(data.get("attrs", {}))
    data["attrs"] = attrs
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
        facts = db.scalars(select(PartyFact).where(
            PartyFact.organization_id == party.organization_id,
            PartyFact.party_id == party.id,
        ).order_by(PartyFact.fact_type.asc(), PartyFact.is_primary.desc(), PartyFact.created_at.asc())).all()
        data["facts"] = [row_dict(fact, {"value": fact.value_text}) for fact in facts]
        custom_values = db.scalars(select(PartyCustomFieldValue).where(
            PartyCustomFieldValue.organization_id == party.organization_id,
            PartyCustomFieldValue.party_id == party.id,
        ).order_by(PartyCustomFieldValue.created_at.asc())).all()
        data["custom_field_values"] = [row_dict(value) for value in custom_values]
        data["activity_count"] = int(db.scalar(select(func.count(ContactActivity.id)).where(
            ContactActivity.organization_id == party.organization_id,
            ContactActivity.party_id == party.id,
        )) or 0)
        if actor and has_permission(actor, "contacts.consent"):
            consents = db.scalars(select(ContactConsentRecord).where(
                ContactConsentRecord.organization_id == party.organization_id,
                ContactConsentRecord.party_id == party.id,
            ).order_by(ContactConsentRecord.effective_at.desc(), ContactConsentRecord.created_at.desc())).all()
            data["consents"] = [row_dict(consent) for consent in consents]
        if actor and has_permission(actor, "contacts.sync"):
            identities = db.scalars(select(ContactExternalIdentity).where(
                ContactExternalIdentity.organization_id == party.organization_id,
                ContactExternalIdentity.party_id == party.id,
            ).order_by(ContactExternalIdentity.provider.asc())).all()
            data["external_identities"] = [row_dict(identity) for identity in identities]
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

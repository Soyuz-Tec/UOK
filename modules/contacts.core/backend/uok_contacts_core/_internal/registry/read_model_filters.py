from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok_contacts_core._internal.persistence.models import Party, PartyRelationship
from uok_contacts_core._internal.registry.read_model_rows import _party_attrs
from uok.kernel.security import Actor

COMPANY_CONTEXT_RELATIONSHIPS = {"works_for", "primary_contact", "supplier_contact", "customer"}
CONTACT_QUALITY_FILTERS = {"all", "no_company", "duplicate_risk"}


def apply_contact_extra_filters(stmt, actor: Actor, source: str, quality: str):
    if source and source != "all":
        stmt = stmt.where(Party.source == source)
    if quality == "duplicate_risk":
        return stmt.where((Party.review_state == "possible_duplicate") | Party.attrs_json.like('%"duplicate_candidates"%'))
    if quality == "no_company":
        return stmt.where(
            Party.party_type == "person",
            ~_has_company_relationship_clause(actor),
            ~Party.attrs_json.like('%"organization_name"%'),
            ~Party.attrs_json.like('%"company_name"%'),
        )
    return stmt


def party_matches_extra_filters(db: Session, actor: Actor, party: Party, source: str, quality: str) -> bool:
    if source and source != "all" and party.source != source:
        return False
    if quality == "duplicate_risk":
        return _has_duplicate_risk(party)
    if quality == "no_company":
        return party.party_type == "person" and not _has_company_context(db, actor, party)
    return True


def validated_quality_filter(value: str) -> str:
    quality = (value or "all").strip()
    if quality not in CONTACT_QUALITY_FILTERS:
        raise ValueError("quality must be one of: all, no_company, duplicate_risk")
    return quality


def _has_company_context(db: Session, actor: Actor, party: Party) -> bool:
    attrs = _party_attrs(party)
    if str(attrs.get("organization_name") or attrs.get("company_name") or "").strip():
        return True
    return db.scalar(
        select(PartyRelationship.id)
        .where(
            PartyRelationship.organization_id == actor.organization_id,
            PartyRelationship.from_party_id == party.id,
            PartyRelationship.relationship_type.in_(tuple(sorted(COMPANY_CONTEXT_RELATIONSHIPS))),
        )
        .limit(1)
    ) is not None


def _has_duplicate_risk(party: Party) -> bool:
    attrs = _party_attrs(party)
    candidates = attrs.get("duplicate_candidates")
    return party.review_state == "possible_duplicate" or bool(candidates)


def _has_company_relationship_clause(actor: Actor):
    return (
        select(PartyRelationship.id)
        .where(
            PartyRelationship.organization_id == actor.organization_id,
            PartyRelationship.from_party_id == Party.id,
            PartyRelationship.relationship_type.in_(tuple(sorted(COMPANY_CONTEXT_RELATIONSHIPS))),
        )
        .exists()
    )

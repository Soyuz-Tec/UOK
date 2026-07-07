from __future__ import annotations

from collections import defaultdict
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import ContactGroup, Party, PartyRelationship
from .validation import MAX_CONTACT_GROUP_NAME_LENGTH
from uok.security import Actor
from uok.util import loads


BUSINESS_DOMAIN_GROUP_PREFIX = "Business domain: "


def business_domain_group_name(db: Session, actor: Actor, domain: str, parties: list[Party]) -> tuple[str, str]:
    relationship_label = _relationship_company_label(db, actor, parties)
    if relationship_label:
        return relationship_label, "relationship_company"
    organization_label = _member_organization_label(parties)
    if organization_label:
        return organization_label, "organization_record"
    return human_domain_label(domain), "domain"


def existing_business_domain_group(db: Session, actor: Actor, domain: str) -> ContactGroup | None:
    old_name = f"{BUSINESS_DOMAIN_GROUP_PREFIX}{domain}"
    groups = db.scalars(select(ContactGroup).where(
        ContactGroup.organization_id == actor.organization_id,
        ContactGroup.kind == "business_domain",
    )).all()
    for group in groups:
        attrs = loads(group.attrs_json, {})
        if attrs.get("domain") == domain or group.name == old_name:
            return group
    return None


def business_domain_group_description(domain: str, name_source: str) -> str:
    if name_source == "relationship_company":
        return f"Contacts with business email domain {domain}; name inferred from linked company relationships."
    if name_source == "organization_record":
        return f"Contacts with business email domain {domain}; name inferred from organization records."
    return f"Contacts with business email domain {domain}."


def available_group_name(db: Session, actor: Actor, base_name: str, domain: str, current_group_id: str | None) -> str:
    name = _clean_company_label(base_name) or human_domain_label(domain)
    duplicate = db.scalar(select(ContactGroup).where(
        ContactGroup.organization_id == actor.organization_id,
        ContactGroup.name == name,
    ))
    if not duplicate or duplicate.id == current_group_id:
        return name
    suffix = f" ({domain})"
    trimmed_base = name[:MAX_CONTACT_GROUP_NAME_LENGTH - len(suffix)].rstrip()
    return f"{trimmed_base}{suffix}"


def human_domain_label(domain: str) -> str:
    stem = domain.split(".", 1)[0]
    words = [word for word in re.split(r"[-_]+", stem) if word]
    if not words:
        return f"{BUSINESS_DOMAIN_GROUP_PREFIX}{domain}"[:MAX_CONTACT_GROUP_NAME_LENGTH]
    return " ".join(word.capitalize() for word in words)[:MAX_CONTACT_GROUP_NAME_LENGTH]


def _relationship_company_label(db: Session, actor: Actor, parties: list[Party]) -> str:
    party_ids = {party.id for party in parties}
    scores: dict[str, int] = defaultdict(int)
    relationships = db.scalars(select(PartyRelationship).where(
        PartyRelationship.organization_id == actor.organization_id,
        (PartyRelationship.from_party_id.in_(party_ids)) | (PartyRelationship.to_party_id.in_(party_ids)),
    )).all()
    for rel in relationships:
        from_party = db.get(Party, rel.from_party_id)
        to_party = db.get(Party, rel.to_party_id)
        related_company = _related_company_party(from_party, to_party, party_ids)
        if not related_company:
            continue
        label = _company_label(related_company)
        if label:
            scores[label] += _relationship_company_weight(rel.relationship_type)
    return _best_label(scores)


def _related_company_party(from_party: Party | None, to_party: Party | None, party_ids: set[str]) -> Party | None:
    if from_party and from_party.id in party_ids and to_party and to_party.party_type == "organization":
        return to_party
    if to_party and to_party.id in party_ids and from_party and from_party.party_type == "organization":
        return from_party
    return None


def _relationship_company_weight(relationship_type: str) -> int:
    if relationship_type == "works_for":
        return 8
    if relationship_type in {"primary_contact", "billing_contact", "decision_maker"}:
        return 6
    return 3


def _member_organization_label(parties: list[Party]) -> str:
    labels: list[str] = []
    scores: dict[str, int] = defaultdict(int)
    for party in parties:
        attrs = loads(party.attrs_json, {})
        if party.party_type == "organization":
            label = _company_label(party)
            if label:
                labels.append(label)
                scores[label] += 5
        organization_name = _clean_company_label(attrs.get("organization_name"))
        if organization_name:
            labels.append(organization_name)
            scores[organization_name] += 3
    shared_prefix = _shared_company_prefix(labels)
    if shared_prefix:
        return shared_prefix
    return _best_label(scores)


def _company_label(party: Party) -> str:
    attrs = loads(party.attrs_json, {})
    return _clean_company_label(attrs.get("organization_name")) or _clean_company_label(party.display_name)


def _clean_company_label(value: Any) -> str:
    label = " ".join(str(value or "").strip().split())
    if not label or "@" in label:
        return ""
    return label[:MAX_CONTACT_GROUP_NAME_LENGTH]


def _shared_company_prefix(labels: list[str]) -> str:
    cleaned = [_clean_company_label(label) for label in labels]
    cleaned = [label for label in cleaned if label]
    if len(cleaned) < 2:
        return ""
    tokenized = [label.split() for label in cleaned if label.split()]
    if len(tokenized) < 2:
        return ""
    common: list[str] = []
    for tokens in zip(*tokenized):
        lowered = {token.lower().strip(".,&") for token in tokens}
        if len(lowered) != 1:
            break
        common.append(tokens[0].strip(".,&"))
    label = " ".join(common).strip()
    if len(label) >= 4 and label.lower() not in {"group", "company", "contact"}:
        return label[:MAX_CONTACT_GROUP_NAME_LENGTH]
    return ""


def _best_label(scores: dict[str, int]) -> str:
    if not scores:
        return ""
    return sorted(scores.items(), key=lambda item: (-item[1], len(item[0]), item[0].lower()))[0][0]

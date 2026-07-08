from __future__ import annotations

from collections import defaultdict
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .command_support import _emit_event
from .group_domain_names import available_group_name
from .models import ContactGroup, Party, PartyRelationship, utcnow
from .validation import MAX_CONTACT_GROUP_NAME_LENGTH, bounded_text
from uok.security import Actor
from uok.util import dumps, loads


DEFAULT_SMART_GROUP_MINIMUM_MEMBERS = 2
MAX_SMART_GROUP_MINIMUM_MEMBERS = 200
SMART_GROUP_RULES = {"country", "organization", "party_type", "review_state", "source"}
RULE_LABELS = {
    "country": "Country",
    "organization": "Company",
    "party_type": "Type",
    "review_state": "Review",
    "source": "Source",
}


def smart_group_rule(value: Any) -> str:
    rule = bounded_text(value, "rule").lower()
    if rule not in SMART_GROUP_RULES:
        raise ValueError(f"rule must be one of: {', '.join(sorted(SMART_GROUP_RULES))}")
    return rule


def minimum_smart_group_members(value: Any) -> int:
    if value in (None, ""):
        return DEFAULT_SMART_GROUP_MINIMUM_MEMBERS
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("minimum_members must be a number") from exc
    if parsed < 1 or parsed > MAX_SMART_GROUP_MINIMUM_MEMBERS:
        raise ValueError(f"minimum_members must be between 1 and {MAX_SMART_GROUP_MINIMUM_MEMBERS}")
    return parsed


def smart_group_members(db: Session, actor: Actor, rule: str) -> dict[str, list[Party]]:
    buckets: dict[str, list[Party]] = defaultdict(list)
    parties = db.scalars(select(Party).where(
        Party.organization_id == actor.organization_id,
        Party.status == "active",
    )).all()
    for party in parties:
        value = smart_group_value(db, actor, rule, party)
        if value and party.id not in {existing.id for existing in buckets[value]}:
            buckets[value].append(party)
    return buckets


def smart_group_value(db: Session, actor: Actor, rule: str, party: Party) -> str:
    attrs = loads(party.attrs_json, {})
    if rule == "country":
        return country_value(attrs.get("address"))
    if rule == "organization":
        return organization_value(db, actor, party, attrs)
    if rule == "party_type":
        return clean_group_value(party.party_type)
    if rule == "review_state":
        return clean_group_value(party.review_state)
    if rule == "source":
        return clean_group_value(party.source)
    return ""


def organization_value(db: Session, actor: Actor, party: Party, attrs: dict[str, Any]) -> str:
    if party.party_type == "organization":
        return clean_group_value(party.display_name)
    local_value = clean_group_value(attrs.get("organization_name") or attrs.get("company_name"))
    return local_value or relationship_organization_value(db, actor, party)


def relationship_organization_value(db: Session, actor: Actor, party: Party) -> str:
    relationship = db.scalar(select(PartyRelationship).where(
        PartyRelationship.organization_id == actor.organization_id,
        PartyRelationship.from_party_id == party.id,
    ).order_by(PartyRelationship.created_at.asc()))
    if not relationship:
        return ""
    organization = db.get(Party, relationship.to_party_id)
    if not organization or organization.organization_id != actor.organization_id or organization.party_type != "organization":
        return ""
    return clean_group_value(organization.display_name)


def country_value(value: Any) -> str:
    text = clean_group_value(value)
    if not text:
        return ""
    parts = [part.strip() for part in text.replace("\n", ",").split(",") if part.strip()]
    return clean_group_value(parts[-1] if parts else "")


def smart_rule_group(db: Session, actor: Actor, rule: str, value: str) -> ContactGroup:
    existing = existing_smart_rule_group(db, actor, rule, value)
    base_name = smart_group_name(rule, value)
    name = available_group_name(db, actor, base_name, value, existing.id if existing else None)
    description = f"Contacts grouped automatically by {RULE_LABELS[rule].lower()}."
    attrs = {"generated_by": "smart_rule", "rule": rule, "value": value}
    if existing:
        return update_smart_rule_group(db, actor, existing, name, description, attrs, rule, value)
    return create_smart_rule_group(db, actor, name, description, attrs)


def update_smart_rule_group(db: Session, actor: Actor, group: ContactGroup, name: str, description: str, attrs: dict[str, str], rule: str, value: str) -> ContactGroup:
    previous_name = group.name
    if group.status == "archived":
        group.status = "active"
        group.archived_at = None
    group.name = name
    group.description = description
    group.kind = "smart_rule"
    group.attrs_json = dumps(attrs)
    group.updated_at = utcnow()
    if previous_name != group.name:
        _emit_event(db, actor, "ContactGroupUpdated", "ContactGroup", group.id, {
            "name": group.name,
            "previous_name": previous_name,
            "rule": rule,
            "value": value,
        })
    return group


def create_smart_rule_group(db: Session, actor: Actor, name: str, description: str, attrs: dict[str, str]) -> ContactGroup:
    now = utcnow()
    group = ContactGroup(
        organization_id=actor.organization_id,
        name=name,
        description=description,
        kind="smart_rule",
        visibility_scope="organization",
        owner_user_id=actor.user_id,
        attrs_json=dumps(attrs),
        created_at=now,
        updated_at=now,
    )
    db.add(group)
    db.flush()
    _emit_event(db, actor, "ContactGroupCreated", "ContactGroup", group.id, {"name": group.name, "kind": group.kind})
    return group


def existing_smart_rule_group(db: Session, actor: Actor, rule: str, value: str) -> ContactGroup | None:
    groups = db.scalars(select(ContactGroup).where(
        ContactGroup.organization_id == actor.organization_id,
        ContactGroup.kind == "smart_rule",
    )).all()
    for group in groups:
        attrs = loads(group.attrs_json, {})
        if attrs.get("generated_by") == "smart_rule" and attrs.get("rule") == rule and attrs.get("value") == value:
            return group
    return None


def smart_group_name(rule: str, value: str) -> str:
    return f"{RULE_LABELS[rule]}: {display_value(rule, value)}"[:MAX_CONTACT_GROUP_NAME_LENGTH]


def display_value(rule: str, value: str) -> str:
    text = clean_group_value(value)
    if rule in {"country", "organization"}:
        return text
    words = text.replace("_", " ").split()
    return " ".join(word.capitalize() for word in words) if words else text


def clean_group_value(value: Any) -> str:
    return " ".join(str(value or "").split())[:MAX_CONTACT_GROUP_NAME_LENGTH]

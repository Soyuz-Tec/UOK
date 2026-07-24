from __future__ import annotations

from collections import defaultdict
from typing import Any

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from uok_contacts_core._internal.delivery.command_support import _emit_event
from uok_contacts_core._internal.groups_relationships.group_domain_names import available_group_name
from uok_contacts_core._internal.persistence.models import ContactGroup, Party, PartyRelationship, utcnow
from uok_contacts_core._internal.registry.validation import MAX_CONTACT_GROUP_NAME_LENGTH, bounded_text
from uok.kernel.security import Actor
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
COMPANY_RELATIONSHIP_PRIORITY = {
    "works_for": 0,
    "primary_contact": 1,
    "supplier_contact": 2,
    "customer": 3,
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
    linked_organizations = relationship_organization_values(db, actor, parties) if rule == "organization" else {}
    for party in parties:
        if rule == "organization" and party.party_type != "organization":
            attrs = loads(party.attrs_json, {})
            value = linked_organizations.get(party.id) or clean_group_value(
                attrs.get("organization_name") or attrs.get("company_name")
            )
        else:
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
    relationship_value = relationship_organization_value(db, actor, party)
    local_value = clean_group_value(attrs.get("organization_name") or attrs.get("company_name"))
    return relationship_value or local_value


def relationship_organization_value(db: Session, actor: Actor, party: Party) -> str:
    return relationship_organization_values(db, actor, [party]).get(party.id, "")


def relationship_organization_values(db: Session, actor: Actor, parties: list[Party]) -> dict[str, str]:
    party_ids = [party.id for party in parties if party.party_type != "organization"]
    if not party_ids:
        return {}
    rows = db.execute(
        select(PartyRelationship, Party)
        .join(
            Party,
            and_(
                Party.id == PartyRelationship.to_party_id,
                Party.organization_id == PartyRelationship.organization_id,
            ),
        )
        .where(
            PartyRelationship.organization_id == actor.organization_id,
            PartyRelationship.from_party_id.in_(party_ids),
            PartyRelationship.relationship_type.in_(tuple(COMPANY_RELATIONSHIP_PRIORITY)),
            Party.party_type == "organization",
            Party.status == "active",
        )
    ).all()
    candidates: dict[str, list[tuple[PartyRelationship, Party]]] = defaultdict(list)
    for relationship, organization in rows:
        candidates[relationship.from_party_id].append((relationship, organization))
    result: dict[str, str] = {}
    for party_id, party_candidates in candidates.items():
        _relationship, organization = min(party_candidates, key=lambda row: (
            COMPANY_RELATIONSHIP_PRIORITY[row[0].relationship_type],
            row[0].created_at.isoformat(),
            row[0].id,
            row[1].id,
        ))
        result[party_id] = clean_group_value(organization.display_name)
    return result


def country_value(value: Any) -> str:
    text = clean_group_value(value)
    if not text:
        return ""
    parts = [part.strip() for part in text.replace("\n", ",").split(",") if part.strip()]
    return clean_group_value(parts[-1] if parts else "")


def smart_rule_group(
    db: Session,
    actor: Actor,
    rule: str,
    value: str,
    existing: ContactGroup | None,
) -> ContactGroup:
    base_name = smart_group_name(rule, value)
    name = available_group_name(db, actor, base_name, value, existing.id if existing else None)
    description = f"Contacts grouped automatically by {RULE_LABELS[rule].lower()}."
    attrs = {"generated_by": "smart_rule", "rule": rule, "value": value}
    if existing:
        return update_smart_rule_group(db, actor, existing, name, description, attrs, rule, value)
    return create_smart_rule_group(db, actor, name, description, attrs)


def update_smart_rule_group(db: Session, actor: Actor, group: ContactGroup, name: str, description: str, attrs: dict[str, str], rule: str, value: str) -> ContactGroup:
    previous_name = group.name
    changed_fields: list[str] = []
    restored = False
    if group.status == "archived":
        group.status = "active"
        group.archived_at = None
        restored = True
    attrs_json = dumps(attrs)
    for field, field_value in (
        ("name", name),
        ("description", description),
        ("kind", "smart_rule"),
        ("attrs_json", attrs_json),
    ):
        if getattr(group, field) != field_value:
            setattr(group, field, field_value)
            changed_fields.append(field)
    if restored or changed_fields:
        group.updated_at = utcnow()
    if restored:
        _emit_event(db, actor, "ContactGroupRestored", "ContactGroup", group.id, {
            "name": group.name,
            "generated": True,
        })
    if changed_fields:
        _emit_event(db, actor, "ContactGroupUpdated", "ContactGroup", group.id, {
            "name": group.name,
            "previous_name": previous_name,
            "rule": rule,
            "value": value,
            "changed_fields": changed_fields,
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
    for group in generated_smart_rule_groups(db, actor, rule):
        attrs = loads(group.attrs_json, {})
        if attrs.get("value") == value:
            return group
    return None


def generated_smart_rule_groups(db: Session, actor: Actor, rule: str) -> list[ContactGroup]:
    groups = db.scalars(select(ContactGroup).where(
        ContactGroup.organization_id == actor.organization_id,
        ContactGroup.kind == "smart_rule",
    ).order_by(ContactGroup.created_at.asc(), ContactGroup.id.asc())).all()
    return [
        group
        for group in groups
        if (attrs := loads(group.attrs_json, {})).get("generated_by") == "smart_rule"
        and attrs.get("rule") == rule
    ]


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

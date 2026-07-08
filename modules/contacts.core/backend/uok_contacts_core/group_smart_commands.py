from __future__ import annotations

from collections import defaultdict
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .command_support import _emit_event
from .group_domain_names import available_group_name
from .group_read_model import serialize_contact_group
from .models import ContactGroup, ContactGroupMember, Party, PartyRelationship, utcnow
from .validation import MAX_CONTACT_GROUP_NAME_LENGTH, bounded_text, validate_contact_payload_lengths
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


def cmd_group_contacts_by_smart_rule(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    validate_contact_payload_lengths(payload)
    rule = _smart_group_rule(payload.get("rule"))
    minimum_members = _minimum_smart_group_members(payload.get("minimum_members"))
    buckets = _smart_group_members(db, actor, rule)
    group_results: list[dict[str, Any]] = []
    skipped_values = 0
    total_added = 0
    total_matched = 0

    for value, parties in sorted(buckets.items()):
        if len(parties) < minimum_members:
            skipped_values += 1
            continue
        group = _smart_rule_group(db, actor, rule, value)
        party_ids = [party.id for party in parties]
        added_count = _add_party_ids_to_group(db, actor, group, party_ids, rule)
        total_added += added_count
        total_matched += len(parties)
        group_results.append({
            "rule": rule,
            "value": value,
            "group": serialize_contact_group(db, group),
            "member_count": len(parties),
            "added_count": added_count,
        })

    _emit_event(db, actor, "ContactsGroupedBySmartRule", "ContactGroup", actor.organization_id, {
        "rule": rule,
        "group_count": len(group_results),
        "contacts_matched": total_matched,
        "added_count": total_added,
        "minimum_members": minimum_members,
    })
    return {
        "rule": rule,
        "group_count": len(group_results),
        "contacts_matched": total_matched,
        "added_count": total_added,
        "minimum_members": minimum_members,
        "skipped_values_below_minimum": skipped_values,
        "groups": group_results,
    }


def _smart_group_rule(value: Any) -> str:
    rule = bounded_text(value, "rule").lower()
    if rule not in SMART_GROUP_RULES:
        raise ValueError(f"rule must be one of: {', '.join(sorted(SMART_GROUP_RULES))}")
    return rule


def _minimum_smart_group_members(value: Any) -> int:
    if value in (None, ""):
        return DEFAULT_SMART_GROUP_MINIMUM_MEMBERS
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("minimum_members must be a number") from exc
    if parsed < 1 or parsed > MAX_SMART_GROUP_MINIMUM_MEMBERS:
        raise ValueError(f"minimum_members must be between 1 and {MAX_SMART_GROUP_MINIMUM_MEMBERS}")
    return parsed


def _smart_group_members(db: Session, actor: Actor, rule: str) -> dict[str, list[Party]]:
    buckets: dict[str, list[Party]] = defaultdict(list)
    parties = db.scalars(select(Party).where(
        Party.organization_id == actor.organization_id,
        Party.status == "active",
    )).all()
    for party in parties:
        value = _smart_group_value(db, actor, rule, party)
        if value and party.id not in {existing.id for existing in buckets[value]}:
            buckets[value].append(party)
    return buckets


def _smart_group_value(db: Session, actor: Actor, rule: str, party: Party) -> str:
    attrs = loads(party.attrs_json, {})
    if rule == "country":
        return _country_value(attrs.get("address"))
    if rule == "organization":
        if party.party_type == "organization":
            return _clean_group_value(party.display_name)
        return _clean_group_value(attrs.get("organization_name") or attrs.get("company_name")) or _relationship_organization_value(db, actor, party)
    if rule == "party_type":
        return _clean_group_value(party.party_type)
    if rule == "review_state":
        return _clean_group_value(party.review_state)
    if rule == "source":
        return _clean_group_value(party.source)
    return ""


def _relationship_organization_value(db: Session, actor: Actor, party: Party) -> str:
    relationship = db.scalar(select(PartyRelationship).where(
        PartyRelationship.organization_id == actor.organization_id,
        PartyRelationship.from_party_id == party.id,
    ).order_by(PartyRelationship.created_at.asc()))
    if not relationship:
        return ""
    organization = db.get(Party, relationship.to_party_id)
    if not organization or organization.organization_id != actor.organization_id or organization.party_type != "organization":
        return ""
    return _clean_group_value(organization.display_name)


def _country_value(value: Any) -> str:
    text = _clean_group_value(value)
    if not text:
        return ""
    parts = [part.strip() for part in text.replace("\n", ",").split(",") if part.strip()]
    return _clean_group_value(parts[-1] if parts else "")


def _smart_rule_group(db: Session, actor: Actor, rule: str, value: str) -> ContactGroup:
    existing = _existing_smart_rule_group(db, actor, rule, value)
    base_name = _smart_group_name(rule, value)
    name = available_group_name(db, actor, base_name, value, existing.id if existing else None)
    description = f"Contacts grouped automatically by {RULE_LABELS[rule].lower()}."
    attrs = {"generated_by": "smart_rule", "rule": rule, "value": value}
    if existing:
        previous_name = existing.name
        if existing.status == "archived":
            existing.status = "active"
            existing.archived_at = None
        existing.name = name
        existing.description = description
        existing.kind = "smart_rule"
        existing.attrs_json = dumps(attrs)
        existing.updated_at = utcnow()
        if previous_name != existing.name:
            _emit_event(db, actor, "ContactGroupUpdated", "ContactGroup", existing.id, {
                "name": existing.name,
                "previous_name": previous_name,
                "rule": rule,
                "value": value,
            })
        return existing

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


def _existing_smart_rule_group(db: Session, actor: Actor, rule: str, value: str) -> ContactGroup | None:
    groups = db.scalars(select(ContactGroup).where(
        ContactGroup.organization_id == actor.organization_id,
        ContactGroup.kind == "smart_rule",
    )).all()
    for group in groups:
        attrs = loads(group.attrs_json, {})
        if attrs.get("generated_by") == "smart_rule" and attrs.get("rule") == rule and attrs.get("value") == value:
            return group
    return None


def _add_party_ids_to_group(db: Session, actor: Actor, group: ContactGroup, party_ids: list[str], rule: str) -> int:
    added_count = 0
    for party_id in party_ids:
        existing = db.scalar(select(ContactGroupMember).where(
            ContactGroupMember.organization_id == actor.organization_id,
            ContactGroupMember.group_id == group.id,
            ContactGroupMember.party_id == party_id,
        ))
        if existing:
            continue
        db.add(ContactGroupMember(
            organization_id=actor.organization_id,
            group_id=group.id,
            party_id=party_id,
            added_by_user_id=actor.user_id,
            attrs_json=dumps({"generated_by": "smart_rule", "rule": rule}),
            created_at=utcnow(),
        ))
        added_count += 1
    group.updated_at = utcnow()
    db.flush()
    if added_count:
        _emit_event(db, actor, "ContactAddedToGroup", "ContactGroup", group.id, {"name": group.name, "added_count": added_count})
    return added_count


def _smart_group_name(rule: str, value: str) -> str:
    return f"{RULE_LABELS[rule]}: {_display_value(rule, value)}"[:MAX_CONTACT_GROUP_NAME_LENGTH]


def _display_value(rule: str, value: str) -> str:
    text = _clean_group_value(value)
    if rule in {"country", "organization"}:
        return text
    words = text.replace("_", " ").split()
    return " ".join(word.capitalize() for word in words) if words else text


def _clean_group_value(value: Any) -> str:
    return " ".join(str(value or "").split())[:MAX_CONTACT_GROUP_NAME_LENGTH]

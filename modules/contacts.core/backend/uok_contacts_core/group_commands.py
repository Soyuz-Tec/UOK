from __future__ import annotations

from collections import defaultdict
from email.utils import parseaddr
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .command_support import _emit_event, _party
from .group_read_model import get_contact_group_or_error, serialize_contact_group
from .models import ContactGroup, ContactGroupMember, Party, PartyRelationship, utcnow
from .validation import (
    MAX_CONTACT_GROUP_NAME_LENGTH,
    bounded_text,
    contact_group_kind,
    contact_group_visibility_scope,
    validate_contact_payload_lengths,
)
from uok.security import Actor
from uok.util import dumps, loads


BUSINESS_DOMAIN_GROUP_PREFIX = "Business domain: "
DEFAULT_DOMAIN_GROUP_MINIMUM_MEMBERS = 2
MAX_DOMAIN_GROUP_MINIMUM_MEMBERS = 200
PERSONAL_EMAIL_DOMAINS = {
    "aol.com",
    "fastmail.com",
    "gmail.com",
    "googlemail.com",
    "hotmail.com",
    "icloud.com",
    "live.com",
    "mail.com",
    "me.com",
    "msn.com",
    "outlook.com",
    "pm.me",
    "proton.me",
    "protonmail.com",
    "yahoo.com",
    "yandex.com",
    "zoho.com",
}
NON_BUSINESS_EMAIL_DOMAINS = {
    "example.com",
    "example.net",
    "example.org",
    "example.test",
    "localhost",
}
NON_BUSINESS_EMAIL_SUFFIXES = (".invalid", ".localhost", ".local", ".test")
DOMAIN_PATTERN = re.compile(r"^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$")


def cmd_create_contact_group(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    validate_contact_payload_lengths(payload)
    name = bounded_text(payload.get("name") or payload.get("group_name"), "group_name")
    if not name:
        raise ValueError("contact group name is required")
    existing = db.scalar(select(ContactGroup).where(
        ContactGroup.organization_id == actor.organization_id,
        ContactGroup.name == name,
    ))
    if existing:
        if existing.status == "archived":
            existing.status = "active"
            existing.archived_at = None
            existing.updated_at = utcnow()
            _emit_event(db, actor, "ContactGroupUpdated", "ContactGroup", existing.id, {"name": existing.name, "restored": True})
            return serialize_contact_group(db, existing)
        raise ValueError("contact group name already exists")
    now = utcnow()
    group = ContactGroup(
        organization_id=actor.organization_id,
        name=name,
        description=bounded_text(payload.get("description"), "group_description"),
        kind=contact_group_kind(payload.get("kind")),
        visibility_scope=contact_group_visibility_scope(payload.get("visibility_scope")),
        owner_user_id=bounded_text(payload.get("owner_user_id"), "owner_user_id") or actor.user_id,
        team_id=bounded_text(payload.get("team_id"), "team_id") or None,
        attrs_json=dumps({}),
        created_at=now,
        updated_at=now,
    )
    db.add(group)
    db.flush()
    _emit_event(db, actor, "ContactGroupCreated", "ContactGroup", group.id, {"name": group.name})
    return serialize_contact_group(db, group)


def cmd_update_contact_group(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    validate_contact_payload_lengths(payload)
    group = get_contact_group_or_error(db, actor, bounded_text(payload.get("group_id"), "group_id"))
    if "name" in payload or "group_name" in payload:
        next_name = bounded_text(payload.get("name") or payload.get("group_name"), "group_name")
        if not next_name:
            raise ValueError("contact group name is required")
        duplicate = db.scalar(select(ContactGroup).where(
            ContactGroup.organization_id == actor.organization_id,
            ContactGroup.name == next_name,
            ContactGroup.id != group.id,
        ))
        if duplicate:
            raise ValueError("contact group name already exists")
        group.name = next_name
    if "description" in payload:
        group.description = bounded_text(payload.get("description"), "group_description")
    if "visibility_scope" in payload:
        group.visibility_scope = contact_group_visibility_scope(payload.get("visibility_scope"))
    if "team_id" in payload:
        group.team_id = bounded_text(payload.get("team_id"), "team_id") or None
    group.updated_at = utcnow()
    _emit_event(db, actor, "ContactGroupUpdated", "ContactGroup", group.id, {"name": group.name})
    return serialize_contact_group(db, group)


def cmd_archive_contact_group(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    validate_contact_payload_lengths(payload)
    group = get_contact_group_or_error(db, actor, bounded_text(payload.get("group_id"), "group_id"))
    group.status = "archived"
    group.archived_at = utcnow()
    group.updated_at = utcnow()
    _emit_event(db, actor, "ContactGroupArchived", "ContactGroup", group.id, {"name": group.name})
    return serialize_contact_group(db, group)


def cmd_add_contacts_to_group(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    validate_contact_payload_lengths(payload)
    group = get_contact_group_or_error(db, actor, bounded_text(payload.get("group_id"), "group_id"))
    if group.status == "archived":
        raise ValueError("archived contact groups cannot be edited")
    party_ids = _party_ids(payload)
    added_count = 0
    for party_id in party_ids:
        party = _party(db, actor, party_id, "party_id")
        existing = db.scalar(select(ContactGroupMember).where(
            ContactGroupMember.organization_id == actor.organization_id,
            ContactGroupMember.group_id == group.id,
            ContactGroupMember.party_id == party.id,
        ))
        if existing:
            continue
        member = ContactGroupMember(
            organization_id=actor.organization_id,
            group_id=group.id,
            party_id=party.id,
            added_by_user_id=actor.user_id,
            attrs_json=dumps({}),
            created_at=utcnow(),
        )
        db.add(member)
        added_count += 1
    group.updated_at = utcnow()
    db.flush()
    _emit_event(db, actor, "ContactAddedToGroup", "ContactGroup", group.id, {"name": group.name, "added_count": added_count})
    return {"group": serialize_contact_group(db, group), "added_count": added_count}


def cmd_group_contacts_by_business_email_domain(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    validate_contact_payload_lengths(payload)
    minimum_members = _minimum_domain_group_members(payload.get("minimum_members"))
    domain_members = _business_domain_members(db, actor)
    group_results: list[dict[str, Any]] = []
    skipped_singletons = 0
    total_added = 0
    total_matched = 0

    for domain, parties in sorted(domain_members.items()):
        if len(parties) < minimum_members:
            skipped_singletons += 1
            continue
        party_ids = [party.id for party in parties]
        group = _business_domain_group(db, actor, domain, parties)
        added_count = _add_party_ids_to_group(db, actor, group, party_ids)
        total_added += added_count
        total_matched += len(parties)
        group_attrs = loads(group.attrs_json, {})
        group_results.append({
            "domain": domain,
            "name_source": group_attrs.get("name_source", "domain"),
            "group": serialize_contact_group(db, group),
            "member_count": len(parties),
            "added_count": added_count,
        })

    _emit_event(db, actor, "ContactsGroupedByBusinessEmailDomain", "ContactGroup", actor.organization_id, {
        "domain_count": len(group_results),
        "contacts_matched": total_matched,
        "added_count": total_added,
        "minimum_members": minimum_members,
    })
    return {
        "domain_count": len(group_results),
        "contacts_matched": total_matched,
        "added_count": total_added,
        "minimum_members": minimum_members,
        "skipped_domains_below_minimum": skipped_singletons,
        "groups": group_results,
    }


def cmd_remove_contact_from_group(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    validate_contact_payload_lengths(payload)
    group = get_contact_group_or_error(db, actor, bounded_text(payload.get("group_id"), "group_id"))
    party = _party(db, actor, bounded_text(payload.get("party_id"), "party_id"), "party_id")
    rows = db.scalars(select(ContactGroupMember).where(
        ContactGroupMember.organization_id == actor.organization_id,
        ContactGroupMember.group_id == group.id,
        ContactGroupMember.party_id == party.id,
    )).all()
    for row in rows:
        db.delete(row)
    group.updated_at = utcnow()
    _emit_event(db, actor, "ContactRemovedFromGroup", "ContactGroup", group.id, {
        "name": group.name,
        "party_id": party.id,
        "removed_count": len(rows),
    })
    return {"group": serialize_contact_group(db, group), "removed_count": len(rows)}


def _party_ids(payload: dict[str, Any]) -> list[str]:
    raw = payload.get("party_ids")
    if raw is None and payload.get("party_id"):
        raw = [payload.get("party_id")]
    if not isinstance(raw, list) or not raw:
        raise ValueError("party_ids is required")
    result: list[str] = []
    for value in raw:
        party_id = bounded_text(value, "party_id")
        if party_id and party_id not in result:
            result.append(party_id)
    if not result:
        raise ValueError("party_ids is required")
    if len(result) > 200:
        raise ValueError("party_ids must contain 200 contacts or fewer")
    return result


def _minimum_domain_group_members(value: Any) -> int:
    if value in (None, ""):
        return DEFAULT_DOMAIN_GROUP_MINIMUM_MEMBERS
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("minimum_members must be a number") from exc
    if parsed < 1 or parsed > MAX_DOMAIN_GROUP_MINIMUM_MEMBERS:
        raise ValueError(f"minimum_members must be between 1 and {MAX_DOMAIN_GROUP_MINIMUM_MEMBERS}")
    return parsed


def _business_domain_members(db: Session, actor: Actor) -> dict[str, list[Party]]:
    members: dict[str, list[Party]] = defaultdict(list)
    parties = db.scalars(select(Party).where(
        Party.organization_id == actor.organization_id,
        Party.status == "active",
    )).all()
    for party in parties:
        attrs = loads(party.attrs_json, {})
        domain = _business_email_domain(attrs.get("email"))
        if domain and party.id not in {existing.id for existing in members[domain]}:
            members[domain].append(party)
    return members


def _business_email_domain(value: Any) -> str:
    _, email_address = parseaddr(str(value or "").strip())
    if "@" not in email_address:
        return ""
    domain = email_address.rsplit("@", 1)[-1].strip().lower().strip(".")
    if not _is_business_domain(domain):
        return ""
    return domain


def _is_business_domain(domain: str) -> bool:
    if (
        not domain
        or domain in PERSONAL_EMAIL_DOMAINS
        or domain in NON_BUSINESS_EMAIL_DOMAINS
        or domain.endswith(NON_BUSINESS_EMAIL_SUFFIXES)
        or len(domain) > 100
        or not DOMAIN_PATTERN.match(domain)
    ):
        return False
    return True


def _business_domain_group(db: Session, actor: Actor, domain: str, parties: list[Party]) -> ContactGroup:
    base_name, name_source = _business_domain_group_name(db, actor, domain, parties)
    existing = _existing_business_domain_group(db, actor, domain)
    name = _available_group_name(db, actor, base_name, domain, existing.id if existing else None)
    if existing:
        previous_name = existing.name
        if existing.status == "archived":
            existing.status = "active"
            existing.archived_at = None
        existing.name = name
        existing.description = _business_domain_group_description(domain, name_source)
        existing.kind = "business_domain"
        existing.attrs_json = dumps({"domain": domain, "generated_by": "business_email_domain", "name_source": name_source})
        existing.updated_at = utcnow()
        if previous_name != existing.name:
            _emit_event(db, actor, "ContactGroupUpdated", "ContactGroup", existing.id, {
                "name": existing.name,
                "previous_name": previous_name,
                "domain": domain,
                "name_source": name_source,
            })
        return existing

    now = utcnow()
    group = ContactGroup(
        organization_id=actor.organization_id,
        name=name,
        description=_business_domain_group_description(domain, name_source),
        kind="business_domain",
        visibility_scope="organization",
        owner_user_id=actor.user_id,
        attrs_json=dumps({"domain": domain, "generated_by": "business_email_domain", "name_source": name_source}),
        created_at=now,
        updated_at=now,
    )
    db.add(group)
    db.flush()
    _emit_event(db, actor, "ContactGroupCreated", "ContactGroup", group.id, {"name": group.name, "kind": group.kind})
    return group


def _business_domain_group_name(db: Session, actor: Actor, domain: str, parties: list[Party]) -> tuple[str, str]:
    relationship_label = _relationship_company_label(db, actor, parties)
    if relationship_label:
        return relationship_label, "relationship_company"
    organization_label = _member_organization_label(parties)
    if organization_label:
        return organization_label, "organization_record"
    return _human_domain_label(domain), "domain"


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


def _human_domain_label(domain: str) -> str:
    stem = domain.split(".", 1)[0]
    words = [word for word in re.split(r"[-_]+", stem) if word]
    if not words:
        return f"{BUSINESS_DOMAIN_GROUP_PREFIX}{domain}"[:MAX_CONTACT_GROUP_NAME_LENGTH]
    return " ".join(word.capitalize() for word in words)[:MAX_CONTACT_GROUP_NAME_LENGTH]


def _available_group_name(db: Session, actor: Actor, base_name: str, domain: str, current_group_id: str | None) -> str:
    name = _clean_company_label(base_name) or _human_domain_label(domain)
    duplicate = db.scalar(select(ContactGroup).where(
        ContactGroup.organization_id == actor.organization_id,
        ContactGroup.name == name,
    ))
    if not duplicate or duplicate.id == current_group_id:
        return name
    suffix = f" ({domain})"
    trimmed_base = name[:MAX_CONTACT_GROUP_NAME_LENGTH - len(suffix)].rstrip()
    return f"{trimmed_base}{suffix}"


def _existing_business_domain_group(db: Session, actor: Actor, domain: str) -> ContactGroup | None:
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


def _business_domain_group_description(domain: str, name_source: str) -> str:
    if name_source == "relationship_company":
        return f"Contacts with business email domain {domain}; name inferred from linked company relationships."
    if name_source == "organization_record":
        return f"Contacts with business email domain {domain}; name inferred from organization records."
    return f"Contacts with business email domain {domain}."


def _add_party_ids_to_group(db: Session, actor: Actor, group: ContactGroup, party_ids: list[str]) -> int:
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
            attrs_json=dumps({"generated_by": "business_email_domain"}),
            created_at=utcnow(),
        ))
        added_count += 1
    group.updated_at = utcnow()
    db.flush()
    if added_count:
        _emit_event(db, actor, "ContactAddedToGroup", "ContactGroup", group.id, {"name": group.name, "added_count": added_count})
    return added_count

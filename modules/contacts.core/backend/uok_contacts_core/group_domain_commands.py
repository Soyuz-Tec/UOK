from __future__ import annotations

from collections import defaultdict
from email.utils import parseaddr
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .command_support import _emit_event
from .group_domain_names import (
    available_group_name,
    business_domain_group_description,
    business_domain_group_name,
    existing_business_domain_group,
)
from .group_read_model import serialize_contact_group
from .models import ContactGroup, ContactGroupMember, Party, utcnow
from .validation import validate_contact_payload_lengths
from uok.security import Actor
from uok.util import dumps, loads


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
        group = _business_domain_group(db, actor, domain, parties)
        party_ids = [party.id for party in parties]
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
    base_name, name_source = business_domain_group_name(db, actor, domain, parties)
    existing = existing_business_domain_group(db, actor, domain)
    name = available_group_name(db, actor, base_name, domain, existing.id if existing else None)
    if existing:
        previous_name = existing.name
        if existing.status == "archived":
            existing.status = "active"
            existing.archived_at = None
        existing.name = name
        existing.description = business_domain_group_description(domain, name_source)
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
        description=business_domain_group_description(domain, name_source),
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

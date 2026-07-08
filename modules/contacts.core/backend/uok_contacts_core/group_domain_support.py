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
from .models import ContactGroup, ContactGroupMember, Party, utcnow
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
NON_BUSINESS_EMAIL_DOMAINS = {"example.com", "example.net", "example.org", "example.test", "localhost"}
NON_BUSINESS_EMAIL_SUFFIXES = (".invalid", ".localhost", ".local", ".test")
DOMAIN_PATTERN = re.compile(r"^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$")


def minimum_domain_group_members(value: Any) -> int:
    if value in (None, ""):
        return DEFAULT_DOMAIN_GROUP_MINIMUM_MEMBERS
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("minimum_members must be a number") from exc
    if parsed < 1 or parsed > MAX_DOMAIN_GROUP_MINIMUM_MEMBERS:
        raise ValueError(f"minimum_members must be between 1 and {MAX_DOMAIN_GROUP_MINIMUM_MEMBERS}")
    return parsed


def business_domain_members(db: Session, actor: Actor) -> dict[str, list[Party]]:
    members: dict[str, list[Party]] = defaultdict(list)
    parties = db.scalars(select(Party).where(
        Party.organization_id == actor.organization_id,
        Party.status == "active",
    )).all()
    for party in parties:
        domain = business_email_domain(loads(party.attrs_json, {}).get("email"))
        if domain and party.id not in {existing.id for existing in members[domain]}:
            members[domain].append(party)
    return members


def business_email_domain(value: Any) -> str:
    _, email_address = parseaddr(str(value or "").strip())
    if "@" not in email_address:
        return ""
    domain = email_address.rsplit("@", 1)[-1].strip().lower().strip(".")
    return domain if is_business_domain(domain) else ""


def is_business_domain(domain: str) -> bool:
    return not (
        not domain
        or domain in PERSONAL_EMAIL_DOMAINS
        or domain in NON_BUSINESS_EMAIL_DOMAINS
        or domain.endswith(NON_BUSINESS_EMAIL_SUFFIXES)
        or len(domain) > 100
        or not DOMAIN_PATTERN.match(domain)
    )


def business_domain_group(db: Session, actor: Actor, domain: str, parties: list[Party]) -> ContactGroup:
    base_name, name_source = business_domain_group_name(db, actor, domain, parties)
    existing = existing_business_domain_group(db, actor, domain)
    name = available_group_name(db, actor, base_name, domain, existing.id if existing else None)
    if existing:
        return update_business_domain_group(db, actor, existing, domain, name, name_source)
    return create_business_domain_group(db, actor, domain, name, name_source)


def update_business_domain_group(db: Session, actor: Actor, group: ContactGroup, domain: str, name: str, name_source: str) -> ContactGroup:
    previous_name = group.name
    if group.status == "archived":
        group.status = "active"
        group.archived_at = None
    group.name = name
    group.description = business_domain_group_description(domain, name_source)
    group.kind = "business_domain"
    group.attrs_json = dumps({"domain": domain, "generated_by": "business_email_domain", "name_source": name_source})
    group.updated_at = utcnow()
    if previous_name != group.name:
        _emit_event(db, actor, "ContactGroupUpdated", "ContactGroup", group.id, {
            "name": group.name,
            "previous_name": previous_name,
            "domain": domain,
            "name_source": name_source,
        })
    return group


def create_business_domain_group(db: Session, actor: Actor, domain: str, name: str, name_source: str) -> ContactGroup:
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


def add_party_ids_to_group(db: Session, actor: Actor, group: ContactGroup, party_ids: list[str], attrs: dict[str, str]) -> int:
    added_count = 0
    for party_id in party_ids:
        if party_already_in_group(db, actor, group, party_id):
            continue
        db.add(ContactGroupMember(
            organization_id=actor.organization_id,
            group_id=group.id,
            party_id=party_id,
            added_by_user_id=actor.user_id,
            attrs_json=dumps(attrs),
            created_at=utcnow(),
        ))
        added_count += 1
    group.updated_at = utcnow()
    db.flush()
    if added_count:
        _emit_event(db, actor, "ContactAddedToGroup", "ContactGroup", group.id, {"name": group.name, "added_count": added_count})
    return added_count


def party_already_in_group(db: Session, actor: Actor, group: ContactGroup, party_id: str) -> bool:
    return db.scalar(select(ContactGroupMember).where(
        ContactGroupMember.organization_id == actor.organization_id,
        ContactGroupMember.group_id == group.id,
        ContactGroupMember.party_id == party_id,
    )) is not None

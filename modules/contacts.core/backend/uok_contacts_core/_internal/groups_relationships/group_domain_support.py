from __future__ import annotations

from collections import defaultdict
from email.utils import parseaddr
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok_contacts_core._internal.delivery.command_support import _emit_event
from uok_contacts_core._internal.groups_relationships.group_domain_names import (
    available_group_name,
    business_domain_group_description,
    business_domain_group_name,
)
from uok_contacts_core._internal.persistence.models import ContactGroup, ContactGroupMember, Party, utcnow
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


def business_domain_group(
    db: Session,
    actor: Actor,
    domain: str,
    parties: list[Party],
    existing: ContactGroup | None,
) -> ContactGroup:
    base_name, name_source = business_domain_group_name(db, actor, domain, parties)
    name = available_group_name(db, actor, base_name, domain, existing.id if existing else None)
    if existing:
        return update_business_domain_group(db, actor, existing, domain, name, name_source)
    return create_business_domain_group(db, actor, domain, name, name_source)


def update_business_domain_group(db: Session, actor: Actor, group: ContactGroup, domain: str, name: str, name_source: str) -> ContactGroup:
    previous_name = group.name
    changed_fields: list[str] = []
    restored = False
    if group.status == "archived":
        group.status = "active"
        group.archived_at = None
        restored = True
    description = business_domain_group_description(domain, name_source)
    attrs_json = dumps({"domain": domain, "generated_by": "business_email_domain", "name_source": name_source})
    for field, value in (
        ("name", name),
        ("description", description),
        ("kind", "business_domain"),
        ("attrs_json", attrs_json),
    ):
        if getattr(group, field) != value:
            setattr(group, field, value)
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
            "domain": domain,
            "name_source": name_source,
            "changed_fields": changed_fields,
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


def generated_business_domain_groups(db: Session, actor: Actor) -> list[ContactGroup]:
    return list(db.scalars(select(ContactGroup).where(
        ContactGroup.organization_id == actor.organization_id,
        ContactGroup.kind == "business_domain",
    ).order_by(ContactGroup.created_at.asc(), ContactGroup.id.asc())).all())


def reconcile_party_ids_to_group(
    db: Session,
    actor: Actor,
    group: ContactGroup,
    party_ids: list[str],
    attrs: dict[str, str],
) -> dict[str, int]:
    requested_ids = sorted(set(party_ids))
    target_ids = set(db.scalars(select(Party.id).where(
        Party.organization_id == actor.organization_id,
        Party.status == "active",
        Party.id.in_(requested_ids),
    )).all()) if requested_ids else set()
    existing_rows = list(db.scalars(select(ContactGroupMember).where(
        ContactGroupMember.organization_id == actor.organization_id,
        ContactGroupMember.group_id == group.id,
    )).all())
    existing_ids = {row.party_id for row in existing_rows}
    removed_rows = [row for row in existing_rows if row.party_id not in target_ids]
    added_ids = sorted(target_ids - existing_ids)
    for row in removed_rows:
        db.delete(row)
    for party_id in added_ids:
        db.add(ContactGroupMember(
            organization_id=actor.organization_id,
            group_id=group.id,
            party_id=party_id,
            added_by_user_id=actor.user_id,
            attrs_json=dumps(attrs),
            created_at=utcnow(),
        ))
    added_count = len(added_ids)
    removed_count = len(removed_rows)
    if added_count or removed_count:
        group.updated_at = utcnow()
        db.flush()
    if added_count:
        _emit_event(db, actor, "ContactAddedToGroup", "ContactGroup", group.id, {
            "name": group.name,
            "added_count": added_count,
            "generated": True,
        })
    if removed_count:
        _emit_event(db, actor, "ContactRemovedFromGroup", "ContactGroup", group.id, {
            "name": group.name,
            "removed_count": removed_count,
            "generated": True,
        })
    return {
        "added_count": added_count,
        "removed_count": removed_count,
        "unchanged_count": len(target_ids & existing_ids),
    }


def archive_generated_group(db: Session, actor: Actor, group: ContactGroup) -> bool:
    if group.status == "archived":
        return False
    group.status = "archived"
    group.archived_at = utcnow()
    group.updated_at = utcnow()
    _emit_event(db, actor, "ContactGroupArchived", "ContactGroup", group.id, {
        "name": group.name,
        "generated": True,
    })
    return True

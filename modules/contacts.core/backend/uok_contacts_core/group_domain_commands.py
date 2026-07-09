from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from .command_support import _emit_event
from .group_domain_support import (
    add_party_ids_to_group,
    business_domain_group,
    business_domain_members,
    minimum_domain_group_members,
)
from .group_read_model import serialize_contact_group
from .validation import validate_contact_payload_lengths
from uok.security import Actor
from uok.util import loads


def cmd_group_contacts_by_business_email_domain(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    validate_contact_payload_lengths(payload)
    minimum_members = minimum_domain_group_members(payload.get("minimum_members"))
    domain_members = business_domain_members(db, actor)
    group_results: list[dict[str, Any]] = []
    skipped_singletons = 0
    total_added = 0
    total_matched = 0

    for domain, parties in sorted(domain_members.items()):
        if len(parties) < minimum_members:
            skipped_singletons += 1
            continue
        group = business_domain_group(db, actor, domain, parties)
        party_ids = [party.id for party in parties]
        added_count = add_party_ids_to_group(db, actor, group, party_ids, {"generated_by": "business_email_domain"})
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

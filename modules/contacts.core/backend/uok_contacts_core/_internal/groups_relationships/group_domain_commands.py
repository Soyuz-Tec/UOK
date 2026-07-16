from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from uok_contacts_core._internal.delivery.command_support import _emit_event
from uok_contacts_core._internal.groups_relationships.group_domain_support import (
    archive_generated_group,
    business_domain_group,
    business_domain_members,
    generated_business_domain_groups,
    minimum_domain_group_members,
    reconcile_party_ids_to_group,
)
from uok_contacts_core._internal.groups_relationships.group_read_model import serialize_contact_group
from uok_contacts_core._internal.registry.validation import validate_contact_payload_lengths
from uok.security import Actor
from uok.util import loads


def cmd_group_contacts_by_business_email_domain(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    validate_contact_payload_lengths(payload)
    minimum_members = minimum_domain_group_members(payload.get("minimum_members"))
    domain_members = business_domain_members(db, actor)
    existing_groups = generated_business_domain_groups(db, actor)
    existing_by_domain = {}
    for group in existing_groups:
        domain = str(loads(group.attrs_json, {}).get("domain") or "")
        if domain:
            existing_by_domain.setdefault(domain, group)
    group_results: list[dict[str, Any]] = []
    skipped_singletons = 0
    total_added = 0
    total_removed = 0
    total_unchanged = 0
    total_matched = 0
    active_group_ids: set[str] = set()

    for domain, parties in sorted(domain_members.items()):
        if len(parties) < minimum_members:
            skipped_singletons += 1
            continue
        group = business_domain_group(db, actor, domain, parties, existing_by_domain.get(domain))
        active_group_ids.add(group.id)
        party_ids = [party.id for party in parties]
        counts = reconcile_party_ids_to_group(
            db,
            actor,
            group,
            party_ids,
            {"generated_by": "business_email_domain"},
        )
        total_added += counts["added_count"]
        total_removed += counts["removed_count"]
        total_unchanged += counts["unchanged_count"]
        total_matched += len(parties)
        group_attrs = loads(group.attrs_json, {})
        group_results.append({
            "domain": domain,
            "name_source": group_attrs.get("name_source", "domain"),
            "group": serialize_contact_group(
                db,
                group,
                member_count=len(party_ids),
                active_member_count=len(party_ids),
            ),
            "member_count": len(parties),
            **counts,
        })

    archived_count = 0
    for group in existing_groups:
        if group.id in active_group_ids:
            continue
        counts = reconcile_party_ids_to_group(
            db,
            actor,
            group,
            [],
            {"generated_by": "business_email_domain"},
        )
        total_removed += counts["removed_count"]
        if archive_generated_group(db, actor, group):
            archived_count += 1

    _emit_event(db, actor, "ContactsGroupedByBusinessEmailDomain", "ContactGroup", actor.organization_id, {
        "domain_count": len(group_results),
        "contacts_matched": total_matched,
        "added_count": total_added,
        "removed_count": total_removed,
        "unchanged_count": total_unchanged,
        "archived_count": archived_count,
        "minimum_members": minimum_members,
    })
    return {
        "domain_count": len(group_results),
        "contacts_matched": total_matched,
        "added_count": total_added,
        "removed_count": total_removed,
        "unchanged_count": total_unchanged,
        "archived_count": archived_count,
        "minimum_members": minimum_members,
        "skipped_domains_below_minimum": skipped_singletons,
        "groups": group_results,
    }

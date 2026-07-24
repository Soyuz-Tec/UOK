from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from uok_contacts_core._internal.delivery.command_support import _emit_event
from uok_contacts_core._internal.groups_relationships.group_domain_support import archive_generated_group, reconcile_party_ids_to_group
from uok_contacts_core._internal.groups_relationships.group_read_model import serialize_contact_group
from uok_contacts_core._internal.groups_relationships.group_smart_support import (
    minimum_smart_group_members,
    generated_smart_rule_groups,
    smart_group_members,
    smart_group_rule,
    smart_rule_group,
)
from uok_contacts_core._internal.registry.validation import validate_contact_payload_lengths
from uok.kernel.security import Actor
from uok.util import loads


def cmd_group_contacts_by_smart_rule(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    validate_contact_payload_lengths(payload)
    rule = smart_group_rule(payload.get("rule"))
    minimum_members = minimum_smart_group_members(payload.get("minimum_members"))
    buckets = smart_group_members(db, actor, rule)
    existing_groups = generated_smart_rule_groups(db, actor, rule)
    existing_by_value = {}
    for group in existing_groups:
        value = str(loads(group.attrs_json, {}).get("value") or "")
        if value:
            existing_by_value.setdefault(value, group)
    group_results: list[dict[str, Any]] = []
    skipped_values = 0
    total_added = 0
    total_removed = 0
    total_unchanged = 0
    total_matched = 0
    active_group_ids: set[str] = set()

    for value, parties in sorted(buckets.items()):
        if len(parties) < minimum_members:
            skipped_values += 1
            continue
        group = smart_rule_group(db, actor, rule, value, existing_by_value.get(value))
        active_group_ids.add(group.id)
        party_ids = [party.id for party in parties]
        counts = reconcile_party_ids_to_group(
            db,
            actor,
            group,
            party_ids,
            {"generated_by": "smart_rule", "rule": rule},
        )
        total_added += counts["added_count"]
        total_removed += counts["removed_count"]
        total_unchanged += counts["unchanged_count"]
        total_matched += len(parties)
        group_results.append({
            "rule": rule,
            "value": value,
            "group": serialize_contact_group(
                db,
                group,
                actor=actor,
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
            {"generated_by": "smart_rule", "rule": rule},
        )
        total_removed += counts["removed_count"]
        if archive_generated_group(db, actor, group):
            archived_count += 1

    _emit_event(db, actor, "ContactsGroupedBySmartRule", "ContactGroup", actor.organization_id, {
        "rule": rule,
        "group_count": len(group_results),
        "contacts_matched": total_matched,
        "added_count": total_added,
        "removed_count": total_removed,
        "unchanged_count": total_unchanged,
        "archived_count": archived_count,
        "minimum_members": minimum_members,
    })
    return {
        "rule": rule,
        "group_count": len(group_results),
        "contacts_matched": total_matched,
        "added_count": total_added,
        "removed_count": total_removed,
        "unchanged_count": total_unchanged,
        "archived_count": archived_count,
        "minimum_members": minimum_members,
        "skipped_values_below_minimum": skipped_values,
        "groups": group_results,
    }

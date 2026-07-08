from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from .command_support import _emit_event
from .group_domain_support import add_party_ids_to_group
from .group_read_model import serialize_contact_group
from .group_smart_support import (
    minimum_smart_group_members,
    smart_group_members,
    smart_group_rule,
    smart_rule_group,
)
from .validation import validate_contact_payload_lengths
from uok.security import Actor


def cmd_group_contacts_by_smart_rule(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    validate_contact_payload_lengths(payload)
    rule = smart_group_rule(payload.get("rule"))
    minimum_members = minimum_smart_group_members(payload.get("minimum_members"))
    buckets = smart_group_members(db, actor, rule)
    group_results: list[dict[str, Any]] = []
    skipped_values = 0
    total_added = 0
    total_matched = 0

    for value, parties in sorted(buckets.items()):
        if len(parties) < minimum_members:
            skipped_values += 1
            continue
        group = smart_rule_group(db, actor, rule, value)
        party_ids = [party.id for party in parties]
        added_count = add_party_ids_to_group(db, actor, group, party_ids, {"generated_by": "smart_rule", "rule": rule})
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

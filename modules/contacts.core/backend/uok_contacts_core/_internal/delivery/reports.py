from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from uok_contacts_core._internal.persistence.models import ContactGroup, ContactGroupMember, ContactImportBatch, Party, PartyNote, PartyRelationship
from uok.models import EventRecord, ModuleRecord
from uok.modules import module_catalog
from uok.security import Actor


def dashboard_counts(db: Session, actor: Actor) -> dict[str, int]:
    return {
        "contacts": db.scalar(select(func.count(Party.id)).where(
            Party.organization_id == actor.organization_id,
            Party.party_type == "person",
            Party.status != "purged",
        )) or 0,
        "organizations": db.scalar(select(func.count(Party.id)).where(
            Party.organization_id == actor.organization_id,
            Party.party_type == "organization",
            Party.status != "purged",
        )) or 0,
        "review_queue": db.scalar(select(func.count(Party.id)).where(
            Party.organization_id == actor.organization_id,
            Party.review_state.in_(("needs_review", "possible_duplicate", "incomplete")),
            Party.status != "purged",
        )) or 0,
        "contact_groups": db.scalar(select(func.count(ContactGroup.id)).where(
            ContactGroup.organization_id == actor.organization_id,
            ContactGroup.status != "archived",
        )) or 0,
    }


def evidence(db: Session, organization_id: str) -> dict[str, Any]:
    event_types = set(db.scalars(select(EventRecord.event_type).where(EventRecord.organization_id == organization_id)).all())
    people = db.scalar(select(func.count(Party.id)).where(Party.organization_id == organization_id, Party.party_type == "person")) or 0
    organizations = db.scalar(select(func.count(Party.id)).where(Party.organization_id == organization_id, Party.party_type == "organization")) or 0
    notes = db.scalar(select(func.count(PartyNote.id)).where(PartyNote.organization_id == organization_id)) or 0
    relationships = db.scalar(select(func.count(PartyRelationship.id)).where(PartyRelationship.organization_id == organization_id)) or 0
    groups = db.scalar(select(func.count(ContactGroup.id)).where(ContactGroup.organization_id == organization_id)) or 0
    group_members = db.scalar(select(func.count(ContactGroupMember.id)).where(ContactGroupMember.organization_id == organization_id)) or 0
    import_batches = db.scalar(select(func.count(ContactImportBatch.id)).where(ContactImportBatch.organization_id == organization_id)) or 0
    review_items = db.scalar(select(func.count(Party.id)).where(
        Party.organization_id == organization_id,
        Party.review_state.in_(("needs_review", "possible_duplicate", "incomplete")),
    )) or 0
    contacts_module = db.scalar(select(ModuleRecord).where(
        ModuleRecord.organization_id == organization_id,
        ModuleRecord.name == "contacts.core",
    ))
    checks = {
        "contacts_module_available_to_install": "contacts.core" in module_catalog(),
        "contacts_module_operational": contacts_module is not None and contacts_module.status in {"installed", "upgraded"},
        "contacts_available": people > 0,
        "organizations_available": organizations > 0,
        "contact_events_present": {"ContactCreated", "ContactLinkedToOrganization"}.issubset(event_types),
        "contact_full_crm_events_present": {
            "ContactUpdated",
            "ContactArchived",
            "ContactRestored",
            "ContactNoteAdded",
            "ContactRelationshipLinked",
            "ContactRelationshipUpdated",
            "ContactRelationshipRemoved",
            "ContactGroupCreated",
            "ContactAddedToGroup",
            "ContactRemovedFromGroup",
            "ContactsImported",
        }.issubset(event_types),
        "private_notes_available": notes > 0,
        "relationships_available": relationships > 0,
        "contact_groups_available": groups > 0,
        "contact_group_members_available": group_members > 0,
        "import_batches_available": import_batches > 0,
        "review_queue_available": review_items > 0,
    }
    return {
        "checks": checks,
        "counts": {
            "contacts": people,
            "organizations": organizations,
            "notes": notes,
            "relationships": relationships,
            "contact_groups": groups,
            "contact_group_members": group_members,
            "import_batches": import_batches,
            "review_items": review_items,
        },
    }

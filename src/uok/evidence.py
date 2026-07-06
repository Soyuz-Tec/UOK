from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import TARGET_VERSION
from .models import CommandLog, ContactImportBatch, EventRecord, GovernanceRule, ModuleRecord, Party, PartyNote, PartyRelationship
from .modules import module_catalog


def baseline_evidence(db: Session, organization_id: str) -> dict[str, Any]:
    status_counts = dict(db.execute(
        select(CommandLog.status, func.count(CommandLog.id))
        .where(CommandLog.organization_id == organization_id)
        .group_by(CommandLog.status)
    ).all())
    event_types = set(db.scalars(select(EventRecord.event_type).where(EventRecord.organization_id == organization_id)).all())
    people = db.scalar(select(func.count(Party.id)).where(Party.organization_id == organization_id, Party.party_type == "person")) or 0
    organizations = db.scalar(select(func.count(Party.id)).where(Party.organization_id == organization_id, Party.party_type == "organization")) or 0
    notes = db.scalar(select(func.count(PartyNote.id)).where(PartyNote.organization_id == organization_id)) or 0
    relationships = db.scalar(select(func.count(PartyRelationship.id)).where(PartyRelationship.organization_id == organization_id)) or 0
    import_batches = db.scalar(select(func.count(ContactImportBatch.id)).where(ContactImportBatch.organization_id == organization_id)) or 0
    review_items = db.scalar(select(func.count(Party.id)).where(Party.organization_id == organization_id, Party.review_state.in_(("needs_review", "possible_duplicate", "incomplete")))) or 0
    modules = db.scalars(select(ModuleRecord).where(ModuleRecord.organization_id == organization_id)).all()
    module_names = {row.name for row in modules}
    declared_modules = set(module_catalog())
    apps_manager = next((row for row in modules if row.name == "apps.manager"), None)
    contacts_module = next((row for row in modules if row.name == "contacts.core"), None)
    rules = set(db.scalars(select(GovernanceRule.rule_name).where(GovernanceRule.organization_id == organization_id)).all())
    checks = {
        "only_declared_modules_installed": module_names.issubset(declared_modules),
        "apps_manager_operational": apps_manager is not None and apps_manager.status in {"installed", "upgraded"},
        "contacts_module_available_to_install": "contacts.core" in declared_modules,
        "contacts_module_operational": contacts_module is not None and contacts_module.status in {"installed", "upgraded"},
        "contacts_available": people > 0,
        "organizations_available": organizations > 0,
        "module_lifecycle_events_present": "ModuleInstalled" in event_types,
        "contact_events_present": {"ContactCreated", "ContactLinkedToOrganization"}.issubset(event_types),
        "contact_full_crm_events_present": {"ContactUpdated", "ContactArchived", "ContactRestored", "ContactNoteAdded", "ContactRelationshipLinked", "ContactsImported"}.issubset(event_types),
        "private_notes_available": notes > 0,
        "relationships_available": relationships > 0,
        "import_batches_available": import_batches > 0,
        "review_queue_available": review_items > 0,
        "role_denials_recorded": int(status_counts.get("denied", 0)) >= 1,
        "validation_errors_recorded": int(status_counts.get("validation_error", 0)) >= 1,
        "baseline_module_neutral_policy_seeded": "baseline.module_neutral.required" in rules,
        "apps_manager_policy_seeded": "apps.manager.bootstrap.required" in rules,
    }
    return {
        "ok": all(checks.values()),
        "target_version": TARGET_VERSION,
        "checks": checks,
        "counts": {
            "contacts": people,
            "organizations": organizations,
            "notes": notes,
            "relationships": relationships,
            "import_batches": import_batches,
            "review_items": review_items,
            "modules": len(modules),
            "events": len(event_types),
            "command_status": status_counts,
        },
    }

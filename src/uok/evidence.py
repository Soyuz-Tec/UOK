from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import TARGET_VERSION
from .host.module_reports import module_evidence_fragments
from .kernel_models import CommandLog, EventRecord, GovernanceRule, ModuleRecord
from .modules import module_catalog


def baseline_evidence(db: Session, organization_id: str) -> dict[str, Any]:
    status_counts = dict(db.execute(
        select(CommandLog.status, func.count(CommandLog.id))
        .where(CommandLog.organization_id == organization_id)
        .group_by(CommandLog.status)
    ).all())
    event_types = set(db.scalars(select(EventRecord.event_type).where(EventRecord.organization_id == organization_id)).all())
    modules = db.scalars(select(ModuleRecord).where(ModuleRecord.organization_id == organization_id)).all()
    module_names = {row.name for row in modules}
    declared_modules = set(module_catalog())
    apps_manager = next((row for row in modules if row.name == "apps.manager"), None)
    rules = set(db.scalars(select(GovernanceRule.rule_name).where(GovernanceRule.organization_id == organization_id)).all())
    checks = {
        "only_declared_modules_installed": module_names.issubset(declared_modules),
        "apps_manager_operational": apps_manager is not None and apps_manager.status in {"installed", "upgraded"},
        "module_lifecycle_events_present": "ModuleInstalled" in event_types,
        "role_denials_recorded": int(status_counts.get("denied", 0)) >= 1,
        "validation_errors_recorded": int(status_counts.get("validation_error", 0)) >= 1,
        "baseline_module_neutral_policy_seeded": "baseline.module_neutral.required" in rules,
        "apps_manager_policy_seeded": "apps.manager.bootstrap.required" in rules,
    }
    module_evidence = module_evidence_fragments(db, organization_id)
    checks.update(module_evidence["checks"])
    counts = {
        "modules": len(modules),
        "events": len(event_types),
        "command_status": status_counts,
    }
    counts.update(module_evidence["counts"])
    return {
        "ok": all(checks.values()),
        "target_version": TARGET_VERSION,
        "checks": checks,
        "counts": counts,
    }

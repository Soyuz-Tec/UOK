from __future__ import annotations

from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from . import TARGET_VERSION
from .evidence import baseline_evidence
from .migration_registry import verify_migration_discipline
from .modules import module_contracts, module_lifecycle_report


def source_boundary_report() -> dict[str, Any]:
    root = Path(__file__).resolve().parents[2]
    findings: list[dict[str, Any]] = []
    forbidden_phrases = [
        "Bo" + "nny",
        "bo" + "nny",
        "BL" + "CO",
        "Product" + " Cargo",
        "product" + " cargo",
        "product" + " transaction",
        "cargo" + " product",
    ]
    for path in sorted((root / "src").rglob("*.py")):
        text = path.read_text(encoding="utf-8")
        for line_no, line in enumerate(text.splitlines(), start=1):
            for phrase in forbidden_phrases:
                if phrase in line:
                    findings.append({
                        "path": path.relative_to(root).as_posix(),
                        "line": line_no,
                        "phrase": phrase,
                        "sample": line.strip(),
                    })
    return {
        "ok": not findings,
        "forbidden_phrases": forbidden_phrases,
        "violation_count": len(findings),
        "violations": findings,
    }


def baseline_report(db: Session, organization_id: str) -> dict[str, Any]:
    migration = verify_migration_discipline(db)
    evidence = baseline_evidence(db, organization_id)
    modules = module_contracts()
    lifecycle = module_lifecycle_report()
    source = source_boundary_report()
    checks = {
        "migration_discipline_ok": migration["ok"],
        "baseline_evidence_ok": evidence["ok"],
        "module_contracts_ok": modules["ok"],
        "module_lifecycle_ok": lifecycle["ok"],
        "source_boundary_ok": source["ok"],
        "module_neutral_baseline": evidence["checks"].get("apps_manager_operational") is True
        and lifecycle["checks"].get("only_apps_manager_required") is True
        and migration["checks"].get("baseline_has_no_business_module_tables") is True,
    }
    return {
        "ok": all(checks.values()),
        "target_version": TARGET_VERSION,
        "checks": checks,
        "migration": migration,
        "baseline_evidence": evidence,
        "module_contracts": modules,
        "module_lifecycle": lifecycle,
        "source_boundary": source,
    }

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from .module_imports import resolve_module_import
from .module_manifest_loader import load_module_manifests
from .security_types import ActorProtocol


def module_dashboard_counts(db: Session, actor: ActorProtocol) -> dict[str, int]:
    counts: dict[str, int] = {}
    for module_name, manifest in load_module_manifests().items():
        if manifest.get("dashboard_provider") is None:
            continue
        provider = resolve_module_import(module_name, manifest, "dashboard_provider")
        fragment = provider(db, actor)
        if not isinstance(fragment, dict):
            raise ValueError(f"module {module_name} dashboard_provider must return a mapping")
        for key, value in fragment.items():
            counts[str(key)] = int(value or 0)
    return counts


def module_evidence_fragments(db: Session, organization_id: str) -> dict[str, dict[str, Any]]:
    checks: dict[str, bool] = {}
    counts: dict[str, Any] = {}
    for module_name, manifest in load_module_manifests().items():
        if manifest.get("evidence_provider") is None:
            continue
        provider = resolve_module_import(module_name, manifest, "evidence_provider")
        fragment = provider(db, organization_id)
        if not isinstance(fragment, dict):
            raise ValueError(f"module {module_name} evidence_provider must return a mapping")
        fragment_checks = fragment.get("checks", {})
        fragment_counts = fragment.get("counts", {})
        if not isinstance(fragment_checks, dict) or not isinstance(fragment_counts, dict):
            raise ValueError(f"module {module_name} evidence_provider must return checks and counts mappings")
        checks.update({str(key): bool(value) for key, value in fragment_checks.items()})
        counts.update({str(key): value for key, value in fragment_counts.items()})
    return {"checks": checks, "counts": counts}

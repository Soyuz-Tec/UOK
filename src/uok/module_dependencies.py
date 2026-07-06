from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import EventRecord, ModuleRecord
from .modules import module_catalog
from .util import dumps

OPERATIONAL_STATUSES = {"installed", "upgraded"}


def emit_module_event(db: Session, organization_id: str, event_type: str, module_name: str, payload: dict[str, Any]) -> None:
    last = db.scalar(select(func.max(EventRecord.sequence)).where(EventRecord.organization_id == organization_id)) or 0
    db.add(EventRecord(
        organization_id=organization_id,
        sequence=int(last) + 1,
        event_type=event_type,
        object_type="Module",
        object_id=module_name,
        payload_json=dumps(payload),
    ))


def command_owner_module(command_type: str) -> str | None:
    for name, manifest in module_catalog().items():
        if command_type in manifest.get("commands", []):
            return name
    return None


def module_record(db: Session, organization_id: str, module_name: str) -> ModuleRecord | None:
    return db.scalar(select(ModuleRecord).where(
        ModuleRecord.organization_id == organization_id,
        ModuleRecord.name == module_name,
    ))


def module_dependents(module_name: str) -> list[str]:
    return [
        name
        for name, manifest in module_catalog().items()
        if module_name in manifest.get("dependencies", [])
    ]


def installed_dependents(db: Session, organization_id: str, module_name: str) -> list[str]:
    dependents = set(module_dependents(module_name))
    if not dependents:
        return []
    rows = db.scalars(select(ModuleRecord).where(
        ModuleRecord.organization_id == organization_id,
        ModuleRecord.name.in_(dependents),
        ModuleRecord.status.in_(OPERATIONAL_STATUSES.union({"disabled"})),
    )).all()
    return sorted(row.name for row in rows)


def ensure_dependencies_operational(db: Session, organization_id: str, module_name: str) -> None:
    manifest = module_catalog().get(module_name)
    if not manifest:
        raise ValueError("module_name is not declared")
    missing: list[str] = []
    for dependency in manifest.get("dependencies", []):
        row = module_record(db, organization_id, dependency)
        if not row or row.status not in OPERATIONAL_STATUSES:
            missing.append(dependency)
    if missing:
        raise ValueError(f"module dependencies are not operational: {', '.join(missing)}")


def ensure_command_module_operational(db: Session, organization_id: str, command_type: str) -> None:
    owner = command_owner_module(command_type)
    if not owner:
        return
    ensure_module_operational(db, organization_id, owner)


def ensure_module_operational(db: Session, organization_id: str, module_name: str) -> None:
    row = module_record(db, organization_id, module_name)
    if not row or row.status not in OPERATIONAL_STATUSES:
        raise ValueError(f"module {module_name} is not installed or enabled")
    ensure_dependencies_operational(db, organization_id, module_name)

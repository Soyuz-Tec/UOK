from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from uok_planning_core._internal.coordination.link_resolver import resolve_target
from uok_planning_core._internal.persistence.models import PlanningResource
from uok_planning_core._internal.resources.resource_calendar import ResourceCalendarSpec
from uok.kernel.security import Actor


def serialize_resource(db: Session, actor: Actor, row: PlanningResource, calendar: ResourceCalendarSpec | None = None) -> dict[str, Any]:
    resolution = None
    target_id = row.canonical_target_id
    if row.canonical_target_kind and target_id:
        resolved = resolve_target(db, actor, row.canonical_target_kind, target_id)
        if resolved.status == "denied":
            target_id = None
        resolution = {
            "status": resolved.status,
            "display_label": resolved.display_label,
            "status_summary": resolved.status_summary,
            "open_path": resolved.open_path,
        }
    return {
        "id": row.id,
        "project_id": row.project_id,
        "name": row.name,
        "role": row.role,
        "resource_type": row.resource_type,
        "capacity_value": float(row.capacity_value),
        "capacity_unit": row.capacity_unit,
        "canonical_target_kind": row.canonical_target_kind,
        "canonical_target_id": target_id,
        "canonical_resolution": resolution,
        "effective_start": row.effective_start.isoformat() if row.effective_start else None,
        "effective_end": row.effective_end.isoformat() if row.effective_end else None,
        "calendar": calendar.as_dict() if calendar else None,
    }


__all__ = ["serialize_resource"]

from __future__ import annotations

import json
from datetime import datetime, timezone
from hashlib import sha256
from hmac import compare_digest
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import PlanningBaseline, PlanningProject, PlanningTask
from uok.security import Actor
from uok.util import loads


COMPLETE_BASELINE_SCHEMA_VERSION = 2
LEGACY_BASELINE_MISSING_FACTS = [
    "project metadata and source revision",
    "task hierarchy, constraints, modes, versions, and calculated metrics",
    "dependencies",
    "calendar and exceptions",
    "resources and assignments",
    "operation, gate, and evidence links",
    "creator and command correlation",
    "integrity checksum",
]
_TASK_TRANSIENT_FIELDS = {
    "baseline_start",
    "baseline_end",
    "start_variance_days",
    "end_variance_days",
}


def complete_baseline_snapshot(
    db: Session,
    actor: Actor,
    project: PlanningProject,
    *,
    baseline_id: str,
    created_at: datetime,
    correlation_id: str,
) -> dict[str, Any]:
    from .read_model import schedule_read_model

    schedule = schedule_read_model(db, actor, project)
    task_rows = {
        row.id: row
        for row in db.scalars(
            select(PlanningTask).where(
                PlanningTask.organization_id == actor.organization_id,
                PlanningTask.project_id == project.id,
            )
        ).all()
    }
    project_attrs = loads(project.attrs_json, {})
    tasks = []
    for task in schedule["tasks"]:
        canonical = {key: value for key, value in task.items() if key not in _TASK_TRANSIENT_FIELDS}
        canonical["attributes"] = loads(task_rows[str(task["id"])].attrs_json, {})
        tasks.append(canonical)
    project_snapshot = {
        **schedule["project"],
        "source_revision": int(project.revision),
        "timezone": project.timezone_name,
        "target_finish": schedule["calculation"]["target_finish"],
        "attributes": project_attrs,
    }
    calendar = {"project_id": project.id, **(schedule.get("calendar") or {})}
    return {
        "schema_version": COMPLETE_BASELINE_SCHEMA_VERSION,
        "project": project_snapshot,
        "tasks": sorted(tasks, key=lambda item: str(item["id"])),
        "dependencies": sorted(schedule["dependencies"], key=lambda item: str(item["id"])),
        "calendar": calendar,
        "resources": sorted(schedule["resources"], key=lambda item: str(item["id"])),
        "assignments": sorted(schedule["assignments"], key=lambda item: str(item["id"])),
        "links": sorted(schedule["links"], key=lambda item: str(item["id"])),
        "participants": sorted(schedule["participants"], key=lambda item: str(item["id"])),
        "requirements": sorted(schedule["requirements"], key=lambda item: str(item["id"])),
        "date_semantics": schedule["date_semantics"],
        "calculation": schedule["calculation"],
        "validation": schedule["validation"],
        "creator": {"user_id": actor.user_id, "username": actor.username},
        "capture": {
            "baseline_id": baseline_id,
            "created_at": _timestamp(created_at),
            "correlation_id": correlation_id,
        },
    }


def canonical_baseline_json(snapshot: dict[str, Any]) -> str:
    return json.dumps(
        snapshot,
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def baseline_checksum(snapshot: dict[str, Any]) -> str:
    return sha256(canonical_baseline_json(snapshot).encode("utf-8")).hexdigest()


def baseline_integrity(row: PlanningBaseline) -> dict[str, Any]:
    snapshot, parse_error = _snapshot_or_error(row)
    if row.completeness != "complete" or int(row.schema_version) < COMPLETE_BASELINE_SCHEMA_VERSION:
        return {
            "status": "partial",
            "verified": False,
            "algorithm": None,
            "missing_facts": LEGACY_BASELINE_MISSING_FACTS,
            "message": "Legacy baseline contains only a partial schedule snapshot and cannot provide forensic comparison.",
        }
    if parse_error:
        return {
            "status": "corrupt",
            "verified": False,
            "algorithm": "sha256",
            "missing_facts": [],
            "message": parse_error,
        }
    shape_errors = _complete_snapshot_shape_errors(snapshot, row)
    if shape_errors:
        return {
            "status": "invalid_snapshot",
            "verified": False,
            "algorithm": "sha256",
            "missing_facts": shape_errors,
            "message": "Complete baseline metadata or canonical snapshot shape is inconsistent.",
        }
    calculated = baseline_checksum(snapshot)
    verified = bool(row.checksum) and compare_digest(str(row.checksum), calculated)
    return {
        "status": "verified" if verified else "checksum_mismatch",
        "verified": verified,
        "algorithm": "sha256",
        "calculated_checksum": calculated,
        "missing_facts": [],
        "message": "Baseline checksum verified." if verified else "Baseline content does not match its stored checksum.",
    }


def baseline_metadata(row: PlanningBaseline) -> dict[str, Any]:
    return {
        "id": row.id,
        "project_id": row.project_id,
        "name": row.name,
        "schema_version": int(row.schema_version),
        "completeness": row.completeness,
        "checksum": row.checksum,
        "source_revision": int(row.source_revision) if row.source_revision is not None else None,
        "created_by_user_id": row.created_by_user_id,
        "correlation_id": row.correlation_id,
        "created_at": _timestamp(row.created_at),
        "integrity": baseline_integrity(row),
    }


def baseline_detail(row: PlanningBaseline) -> dict[str, Any]:
    snapshot, _ = _snapshot_or_error(row)
    return {**baseline_metadata(row), "snapshot": snapshot}


def baseline_or_error(db: Session, actor: Actor, project_id: str, baseline_id: str) -> PlanningBaseline:
    row = db.scalar(
        select(PlanningBaseline).where(
            PlanningBaseline.id == baseline_id,
            PlanningBaseline.project_id == project_id,
            PlanningBaseline.organization_id == actor.organization_id,
        )
    )
    if not row:
        raise ValueError("baseline_id not found")
    return row


def compare_baselines(
    db: Session,
    actor: Actor,
    project_id: str,
    left_baseline_id: str,
    right_baseline_id: str,
) -> dict[str, Any]:
    left = baseline_or_error(db, actor, project_id, left_baseline_id)
    right = baseline_or_error(db, actor, project_id, right_baseline_id)
    left_meta = baseline_metadata(left)
    right_meta = baseline_metadata(right)
    unsupported = [
        side
        for side, metadata in (("left", left_meta), ("right", right_meta))
        if metadata["completeness"] != "complete" or not metadata["integrity"]["verified"]
    ]
    if unsupported:
        return {
            "project_id": project_id,
            "supported": False,
            "left": left_meta,
            "right": right_meta,
            "limitations": [
                f"{side} baseline is partial, corrupt, or not hash verified; complete v2 snapshots are required."
                for side in unsupported
            ],
            "changes": None,
        }
    left_snapshot, _ = _snapshot_or_error(left)
    right_snapshot, _ = _snapshot_or_error(right)
    return {
        "project_id": project_id,
        "supported": True,
        "left": left_meta,
        "right": right_meta,
        "limitations": [],
        "changes": {
            "project_fields": _changed_fields(left_snapshot["project"], right_snapshot["project"]),
            "tasks": _collection_delta(left_snapshot["tasks"], right_snapshot["tasks"]),
            "dependencies": _collection_delta(left_snapshot["dependencies"], right_snapshot["dependencies"]),
            "resources": _collection_delta(left_snapshot["resources"], right_snapshot["resources"]),
            "assignments": _collection_delta(left_snapshot["assignments"], right_snapshot["assignments"]),
            "links": _collection_delta(left_snapshot["links"], right_snapshot["links"]),
            "participants": _collection_delta(left_snapshot.get("participants", []), right_snapshot.get("participants", [])),
            "requirements": _collection_delta(left_snapshot.get("requirements", []), right_snapshot.get("requirements", [])),
            "calendar_changed": left_snapshot["calendar"] != right_snapshot["calendar"],
            "calculation_changed": left_snapshot["calculation"] != right_snapshot["calculation"],
        },
    }


def _changed_fields(left: dict[str, Any], right: dict[str, Any]) -> list[str]:
    return sorted(key for key in set(left) | set(right) if left.get(key) != right.get(key))


def _collection_delta(left: list[dict[str, Any]], right: list[dict[str, Any]]) -> dict[str, list[str]]:
    left_by_id = {str(item["id"]): item for item in left}
    right_by_id = {str(item["id"]): item for item in right}
    shared = set(left_by_id) & set(right_by_id)
    return {
        "added": sorted(set(right_by_id) - set(left_by_id)),
        "removed": sorted(set(left_by_id) - set(right_by_id)),
        "changed": sorted(item_id for item_id in shared if left_by_id[item_id] != right_by_id[item_id]),
    }


def _snapshot_or_error(row: PlanningBaseline) -> tuple[dict[str, Any], str | None]:
    try:
        snapshot = loads(row.snapshot_json, {})
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        return {}, f"Baseline snapshot is not valid JSON: {exc}"
    if not isinstance(snapshot, dict):
        return {}, "Baseline snapshot must be a JSON object."
    return snapshot, None


def _complete_snapshot_shape_errors(snapshot: dict[str, Any], row: PlanningBaseline) -> list[str]:
    errors: list[str] = []
    required_objects = ("project", "calendar", "calculation", "validation", "creator", "capture")
    required_lists = ("tasks", "dependencies", "resources", "assignments", "links")
    for key in required_objects:
        if not isinstance(snapshot.get(key), dict):
            errors.append(key)
    for key in required_lists:
        if not isinstance(snapshot.get(key), list):
            errors.append(key)
    if errors:
        return errors
    if int(snapshot.get("schema_version") or 0) != int(row.schema_version):
        errors.append("schema_version")
    if snapshot["project"].get("source_revision") != row.source_revision:
        errors.append("source_revision")
    if snapshot["creator"].get("user_id") != row.created_by_user_id:
        errors.append("created_by_user_id")
    if snapshot["capture"].get("baseline_id") != row.id:
        errors.append("baseline_id")
    if snapshot["capture"].get("correlation_id") != row.correlation_id:
        errors.append("correlation_id")
    return errors


def _timestamp(value: datetime) -> str:
    if value.tzinfo is None or value.utcoffset() is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


__all__ = [
    "COMPLETE_BASELINE_SCHEMA_VERSION",
    "baseline_checksum",
    "baseline_detail",
    "baseline_integrity",
    "baseline_metadata",
    "baseline_or_error",
    "canonical_baseline_json",
    "compare_baselines",
    "complete_baseline_snapshot",
]

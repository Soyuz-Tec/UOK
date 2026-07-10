from __future__ import annotations

import json
from datetime import datetime, timezone
from hashlib import sha256
from hmac import compare_digest
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import PlanningAnalysisRun
from .risk_engine import RISK_ENGINE_NAME, RISK_ENGINE_VERSION, run_risk_engine, validate_risk_result
from .scheduler import project_or_error
from .what_if import what_if_integrity, what_if_or_error
from uok.security import Actor
from uok.util import dumps, loads


def create_risk_analysis(db: Session, actor: Actor, project_id: str, payload: dict[str, Any], command_id: str) -> PlanningAnalysisRun:
    snapshot = what_if_or_error(db, actor, project_id, str(payload.get("snapshot_id") or ""))
    if not what_if_integrity(snapshot)["verified"]:
        raise ValueError("risk analysis requires a verified what-if snapshot")
    snapshot_data = loads(snapshot.snapshot_json, {})
    inputs, limits, result = run_risk_engine(snapshot_data, payload)
    inputs = {"snapshot_id": snapshot.id, "snapshot_checksum": snapshot.checksum, **inputs}
    issues = validate_risk_result(inputs, result)
    result["independent_validation"] = {"ok": not issues, "violations": issues}
    if issues:
        raise ValueError("independent risk validation failed: " + "; ".join(issue["message"] for issue in issues))
    created_at = datetime.now(timezone.utc)
    content = {
        "analysis_type": "risk",
        "status": "completed",
        "engine": {"name": RISK_ENGINE_NAME, "version": RISK_ENGINE_VERSION},
        "inputs": inputs,
        "limits": limits,
        "result": result,
    }
    row = PlanningAnalysisRun(
        id=str(uuid4()), organization_id=actor.organization_id, project_id=project_id,
        snapshot_id=snapshot.id, analysis_type="risk", status="completed",
        engine_name=RISK_ENGINE_NAME, engine_version=RISK_ENGINE_VERSION,
        seed=int(inputs["seed"]), inputs_json=dumps(inputs), limits_json=dumps(limits),
        result_json=dumps(result), checksum=analysis_checksum(content),
        created_by_user_id=actor.user_id, correlation_id=command_id, created_at=created_at,
    )
    db.add(row)
    db.flush()
    return row


def list_risk_analyses(db: Session, actor: Actor, project_id: str) -> list[dict[str, Any]]:
    project_or_error(db, actor, project_id)
    rows = db.scalars(select(PlanningAnalysisRun).where(
        PlanningAnalysisRun.organization_id == actor.organization_id,
        PlanningAnalysisRun.project_id == project_id,
        PlanningAnalysisRun.analysis_type == "risk",
    ).order_by(PlanningAnalysisRun.created_at.desc()).limit(100)).all()
    return [analysis_metadata(row) for row in rows]


def risk_analysis_or_error(db: Session, actor: Actor, project_id: str, run_id: str) -> PlanningAnalysisRun:
    project_or_error(db, actor, project_id)
    row = db.scalar(select(PlanningAnalysisRun).where(
        PlanningAnalysisRun.id == run_id,
        PlanningAnalysisRun.organization_id == actor.organization_id,
        PlanningAnalysisRun.project_id == project_id,
        PlanningAnalysisRun.analysis_type == "risk",
    ))
    if not row:
        raise ValueError("risk_analysis_id not found")
    return row


def analysis_metadata(row: PlanningAnalysisRun) -> dict[str, Any]:
    result = loads(row.result_json, {})
    return {
        "id": row.id, "project_id": row.project_id, "snapshot_id": row.snapshot_id,
        "analysis_type": row.analysis_type, "status": row.status,
        "engine": {"name": row.engine_name, "version": row.engine_version},
        "seed": row.seed, "checksum": row.checksum,
        "created_by_user_id": row.created_by_user_id, "correlation_id": row.correlation_id,
        "created_at": _timestamp(row.created_at), "result_summary": {
            "finish_percentiles": result.get("finish_percentiles", {}),
            "probability_on_or_before_target": result.get("probability_on_or_before_target"),
            "sample_count": result.get("sample_count"),
        },
        "integrity": analysis_integrity(row),
    }


def analysis_detail(row: PlanningAnalysisRun) -> dict[str, Any]:
    return {
        **analysis_metadata(row),
        "inputs": loads(row.inputs_json, {}),
        "limits": loads(row.limits_json, {}),
        "result": loads(row.result_json, {}),
    }


def analysis_integrity(row: PlanningAnalysisRun) -> dict[str, Any]:
    try:
        content = {
            "analysis_type": row.analysis_type,
            "status": row.status,
            "engine": {"name": row.engine_name, "version": row.engine_version},
            "inputs": loads(row.inputs_json, {}),
            "limits": loads(row.limits_json, {}),
            "result": loads(row.result_json, {}),
        }
        calculated = analysis_checksum(content)
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        return {"status": "corrupt", "verified": False, "message": f"Analysis JSON is invalid: {exc}"}
    verified = compare_digest(str(row.checksum), calculated)
    return {
        "status": "verified" if verified else "checksum_mismatch",
        "verified": verified, "algorithm": "sha256", "calculated_checksum": calculated,
        "message": "Analysis checksum verified." if verified else "Analysis content does not match its checksum.",
    }


def analysis_checksum(content: dict[str, Any]) -> str:
    canonical = json.dumps(content, ensure_ascii=False, allow_nan=False, separators=(",", ":"), sort_keys=True)
    return sha256(canonical.encode("utf-8")).hexdigest()


def _timestamp(value: datetime) -> str:
    if value.tzinfo is None or value.utcoffset() is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


__all__ = [
    "analysis_checksum", "analysis_detail", "analysis_integrity", "analysis_metadata",
    "create_risk_analysis", "list_risk_analyses", "risk_analysis_or_error",
]

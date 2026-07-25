from __future__ import annotations

from pathlib import Path
from typing import Any

import engineering_measurements
from quality_scorecard_contract import (
    CATEGORY,
    CATEGORY_DEFINITIONS,
    GRADE_THRESHOLDS,
    LIMITATIONS,
    MEASUREMENT_SCHEMA,
    MEASUREMENT_STATUS_SCHEMA,
    REPEATABILITY,
    SCHEMA_COMPATIBILITY,
    SCORECARD_SCHEMA,
    STATIC_CONTROL_CAP,
    UNAVAILABLE_REASONS,
    ScoreCategory,
)
from quality_scorecard_source_size import source_size_metrics as _source_size_metrics

REPO_ROOT = Path(__file__).resolve().parents[1]


def _check_map(audit_report: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        str(check["name"]): {
            "ok": bool(check["ok"]),
            "details": str(check.get("details", "")),
        }
        for check in audit_report.get("checks", [])
        if "name" in check
    }


def _check_score(
    checks: dict[str, dict[str, Any]],
    name: str,
    source_metrics: dict[str, Any],
) -> int:
    check = checks.get(name, {"ok": False, "details": ""})
    if not check["ok"]:
        return 0
    if name == "source_size":
        ratchet_status = source_metrics["ratchet"]["status"]
        if source_metrics["hard_count"] or ratchet_status in {
            "violations",
            "baseline_update_required",
            "not_evaluated",
        }:
            return 0
        if source_metrics["soft_count"] or source_metrics["active_exception_count"]:
            return 75
    if name == "community_governance" and "external:" in check["details"]:
        return 75
    return 100


def _audit_category(
    definition: CATEGORY,
    checks: dict[str, dict[str, Any]],
    source_metrics: dict[str, Any],
) -> ScoreCategory:
    name, required, improvement, _ = definition
    raw_score = round(
        sum(_check_score(checks, item, source_metrics) for item in required)
        / len(required)
    )
    score = min(STATIC_CONTROL_CAP, raw_score)
    evidence = []
    for check_name in required:
        check_score = _check_score(checks, check_name, source_metrics)
        status = "pass" if check_score == 100 else "review" if check_score else "fail"
        evidence.append(f"{check_name}: {status}")
    metrics = source_metrics if "source_size" in required else {}
    return ScoreCategory(
        name=name,
        score=score,
        status="scored",
        basis="static_repository_control_conformance",
        evidence=evidence,
        improvement=improvement,
        metrics=metrics,
    )


def _measurement_category(
    definition: CATEGORY,
    measurements: dict[str, Any] | None,
) -> tuple[ScoreCategory, dict[str, Any]]:
    name, _, improvement, _ = definition
    categories = measurements["categories"] if measurements else {}
    measurement = categories.get(
        name,
        {
            "status": "unavailable",
            "reason": UNAVAILABLE_REASONS[name],
        },
    )
    if measurement["status"] == "measured":
        evidence = [
            f"{name}: measured",
            f"method: {measurement['method']}",
            *(f"source: {source['path']}" for source in measurement["sources"]),
        ]
        values = (
            engineering_measurements.coverage_score(measurement["metrics"]),
            "measured",
            "verified_local_measurement",
            evidence,
            dict(measurement["metrics"]),
        )
    else:
        values = (
            None,
            "unavailable",
            "measurement_required",
            [f"{name}: unavailable", str(measurement["reason"])],
            {},
        )
    score, status, basis, evidence, metrics = values
    return ScoreCategory(
        name=name,
        score=score,
        status=status,
        basis=basis,
        evidence=evidence,
        improvement=improvement,
        metrics=metrics,
    ), measurement


def _grade(score: int | None) -> str:
    if score is None:
        return "N/A"
    for threshold, grade in GRADE_THRESHOLDS:
        if score >= threshold:
            return grade
    return "F"


def _score_categories(
    checks: dict[str, dict[str, Any]],
    source_metrics: dict[str, Any],
    measurements: dict[str, Any] | None,
) -> tuple[list[ScoreCategory], dict[str, Any]]:
    scored: list[ScoreCategory] = []
    measurement_evidence: dict[str, Any] = {}
    for definition in CATEGORY_DEFINITIONS:
        name, _, _, measurement_required = definition
        if measurement_required:
            category, measurement = _measurement_category(definition, measurements)
            measurement_evidence[name] = measurement
            scored.append(category)
        else:
            scored.append(_audit_category(definition, checks, source_metrics))
    return scored, measurement_evidence


def _conformance_summary(
    scored: list[ScoreCategory],
) -> tuple[int | None, int, dict[str, Any]]:
    available = [category.score for category in scored if category.score is not None]
    overall = round(sum(available) / len(available)) if available else None
    unavailable = [category.name for category in scored if category.score is None]
    completeness = round(100 * len(available) / len(scored))
    return (
        overall,
        completeness,
        {
            "score": overall,
            "grade": _grade(overall),
            "status": "complete" if not unavailable else "partial",
            "scored_category_count": len(available),
            "total_category_count": len(scored),
            "evidence_completeness_percent": completeness,
            "unavailable_categories": unavailable,
        },
    )


def build_scorecard(
    audit_report: dict[str, Any],
    *,
    source_size_report: dict[str, Any] | None = None,
    measurements: dict[str, Any] | None = None,
    measurement_repo_root: Path = REPO_ROOT,
) -> dict[str, Any]:
    if measurements is not None:
        measurements = engineering_measurements.validate_measurements(
            measurements, measurement_repo_root
        )
    checks = _check_map(audit_report)
    source_metrics = _source_size_metrics(source_size_report)
    scored, measurement_evidence = _score_categories(
        checks,
        source_metrics,
        measurements,
    )
    overall, completeness, conformance = _conformance_summary(scored)
    audit_total = len(checks)
    trend_metrics = {
        "quality_audit_check_count": audit_total,
        "quality_audit_pass_count": sum(1 for check in checks.values() if check["ok"]),
        "quality_audit_fail_count": sum(
            1 for check in checks.values() if not check["ok"]
        ),
        "evidence_completeness_percent": completeness,
        "source_size": source_metrics,
    }
    measurement_view = measurements or {
        "schema": MEASUREMENT_STATUS_SCHEMA,
        "accepted_input_schema": MEASUREMENT_SCHEMA,
        "status": "not_supplied",
        "categories": measurement_evidence,
    }
    return {
        "schema": SCORECARD_SCHEMA,
        "schema_compatibility": dict(SCHEMA_COMPATIBILITY),
        "title": "UOK Repository Conformance Scorecard",
        "score_semantics": "repository_conformance",
        "overall_score": overall,
        "grade": _grade(overall),
        "repository_conformance": conformance,
        "quality_audit_ok": bool(audit_report.get("ok")),
        "categories": [category.__dict__ for category in scored],
        "measurement_evidence": measurement_view,
        "trend_metrics": trend_metrics,
        "limitations": list(LIMITATIONS),
        "repeatability": dict(REPEATABILITY),
    }

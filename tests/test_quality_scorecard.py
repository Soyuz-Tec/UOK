from __future__ import annotations

import sys
from pathlib import Path

import pytest


SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import quality_scorecard  # noqa: E402
from quality_scorecard_source_size import soft_finding_metrics  # noqa: E402


@pytest.fixture(scope="module")
def quality_inputs() -> tuple[dict[str, object], dict[str, object]]:
    review_details = {
        "source_size": "structured report supplied",
        "community_governance": (
            "external: repository license requires owner legal decision; "
            "external: independent reviewer requires GitHub collaborator configuration"
        ),
    }
    check_names = (
        "required_artifacts",
        "runtime_stack",
        "module_shape",
        "source_size",
        "operations_hygiene",
        "frontend_stack",
        "documentation_references",
        "internal_engineering_system",
        "community_governance",
    )
    audit = {
        "ok": True,
        "checks": [
            {"name": name, "ok": True, "details": review_details.get(name, "pass")}
            for name in check_names
        ],
    }
    source_size = {
        "schema": "uok.source_size_report.v1",
        "ok": True,
        "scanned_file_count": 10,
        "hard_count": 0,
        "hard_cap_count": 0,
        "soft_count": 2,
        "active_exception_count": 0,
        "hard_findings": [],
        "soft_findings": [
            {
                "identity": "file:tests/test_example.py",
                "kind": "file",
                "path": "tests/test_example.py",
                "lines": 220,
                "threshold": 200,
                "severity": "soft",
                "rule": "file_soft_200",
                "reason": "file exceeds soft review threshold",
            },
            {
                "identity": "function:src/uok/example.py::example",
                "kind": "function",
                "path": "src/uok/example.py",
                "lines": 70,
                "threshold": 60,
                "severity": "soft",
                "rule": "function_soft_60",
                "reason": "function exceeds preferred length",
                "symbol": "example",
                "line": 10,
            },
        ],
        "active_exceptions": [],
        "ratchet": {
            "status": "clean",
            "new_count": 0,
            "growth_count": 0,
            "resolved_count": 1,
            "baseline_count": 3,
            "current_count": 2,
        },
    }
    return audit, source_size


def test_quality_scorecard_is_repeatable_and_complete(
    quality_inputs: tuple[dict[str, object], dict[str, object]],
) -> None:
    audit, source_size = quality_inputs
    scorecard = quality_scorecard.build_scorecard(
        audit,
        source_size_report=source_size,
    )

    assert scorecard["schema"] == "uok.quality_scorecard.v2"
    assert scorecard["score_semantics"] == "repository_conformance"
    assert scorecard["title"] == "UOK Repository Conformance Scorecard"
    assert scorecard["quality_audit_ok"] is True
    assert 0 <= scorecard["overall_score"] <= 100
    assert scorecard["overall_score"] == scorecard["repository_conformance"]["score"]
    assert scorecard["grade"] == scorecard["repository_conformance"]["grade"]
    assert scorecard["repository_conformance"]["status"] == "partial"
    assert len(scorecard["categories"]) == 10
    assert all(
        category["score"] is None or 0 <= category["score"] <= 100
        for category in scorecard["categories"]
    )
    static_categories = [
        category
        for category in scorecard["categories"]
        if category["basis"] == "static_repository_control_conformance"
    ]
    assert static_categories
    assert max(category["score"] for category in static_categories) == 95

    unavailable = {
        category["name"]
        for category in scorecard["categories"]
        if category["status"] == "unavailable"
    }
    assert unavailable == {
        "test_coverage",
        "runtime_efficiency",
        "security_and_supply_chain",
        "ci_and_release_readiness",
    }
    assert scorecard["repository_conformance"]["evidence_completeness_percent"] == 60
    assert all(
        category["score"] is None
        for category in scorecard["categories"]
        if category["name"] in unavailable
    )
    source_size_evidence = [
        evidence
        for category in scorecard["categories"]
        for evidence in category["evidence"]
        if evidence.startswith("source_size:")
    ]
    assert source_size_evidence
    assert source_size_evidence == ["source_size: review"]
    source_metrics = scorecard["trend_metrics"]["source_size"]
    assert source_metrics["report_schema"] == "uok.source_size_report.v1"
    assert source_metrics["soft_count"] == source_size["soft_count"]
    assert source_metrics["ratchet"] == source_size["ratchet"]
    assert source_metrics["hard_warning_count"] == source_size["hard_count"]
    assert source_metrics["soft_warning_count"] == source_size["soft_count"]
    assert source_metrics["soft_file_warning_count"] == 1
    assert source_metrics["soft_function_warning_count"] == 1
    assert source_metrics["soft_affected_path_count"] == 2
    assert source_metrics["soft_warning_identity_count"] == 2
    assert source_metrics["soft_malformed_finding_count"] == 0
    assert (
        sum(source_metrics["soft_warnings_by_rule"].values())
        == source_size["soft_count"]
    )
    documentation = next(
        category
        for category in scorecard["categories"]
        if category["name"] == "documentation"
    )
    assert "documentation_references: pass" in documentation["evidence"]
    assert "community_governance: review" in documentation["evidence"]
    repeatability = scorecard["repeatability"]
    assert "EngineeringEvidence" in repeatability["control_only_command"]
    assert (
        "build_engineering_measurements.py"
        in repeatability["measurement_build_command"]
    )
    assert "--measurements" in repeatability["measured_evidence_command"]
    assert "uok_engineering_ci.json" in repeatability["ci_evidence_command"]
    assert "not engineering maturity" in scorecard["limitations"][0]


@pytest.mark.parametrize(
    "finding",
    [
        None,
        {"kind": []},
        {"kind": "file", "path": "src/a.py"},
        {
            "kind": "function",
            "path": "src/a.py",
            "identity": "function:src/a.py::wrong",
            "symbol": "actual",
            "rule": "function_soft_60",
        },
    ],
)
def test_malformed_soft_findings_are_ignored_safely(finding: object) -> None:
    metrics = soft_finding_metrics([finding])

    assert metrics["file_count"] == 0
    assert metrics["function_count"] == 0
    assert metrics["malformed_count"] == 1

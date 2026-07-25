from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import engineering_measurements


SCORECARD_SCHEMA = "uok.quality_scorecard.v2"
MEASUREMENT_SCHEMA = engineering_measurements.MEASUREMENT_SCHEMA
MEASUREMENT_STATUS_SCHEMA = "uok.engineering_measurement_status.v1"
GRADE_THRESHOLDS = ((95, "A"), (85, "B"), (75, "C"), (65, "D"))
STATIC_CONTROL_CAP = 95


@dataclass(frozen=True)
class ScoreCategory:
    name: str
    score: int | None
    status: str
    basis: str
    evidence: list[str]
    improvement: str
    metrics: dict[str, Any]


CATEGORY = tuple[str, tuple[str, ...], str, bool]
CATEGORY_DEFINITIONS = (
    (
        "correctness",
        ("required_artifacts", "runtime_stack", "module_shape"),
        "Run Verify after behavior changes.",
        False,
    ),
    ("test_coverage", (), "Provide measured line and branch coverage.", True),
    (
        "split_quality",
        ("source_size", "operations_hygiene"),
        "Split mixed or oversized source.",
        False,
    ),
    (
        "reuse_and_boundaries",
        ("module_shape", "operations_hygiene"),
        "Move reuse to the smallest shared owner.",
        False,
    ),
    (
        "module_discipline",
        ("module_shape", "runtime_stack"),
        "Keep behavior and tests module-owned.",
        False,
    ),
    (
        "ui_consistency",
        ("frontend_stack", "required_artifacts"),
        "Keep durable UI typed and policy-aligned.",
        False,
    ),
    (
        "runtime_efficiency",
        (),
        "Register latency, throughput, and resource measurements.",
        True,
    ),
    (
        "security_and_supply_chain",
        (),
        "Provide current scanner, provenance, and control evidence.",
        True,
    ),
    (
        "documentation",
        (
            "required_artifacts",
            "documentation_references",
            "operations_hygiene",
            "internal_engineering_system",
            "community_governance",
        ),
        "Update owning Markdown artifacts.",
        False,
    ),
    (
        "ci_and_release_readiness",
        (),
        "Provide current hosted-CI and immutable-release evidence.",
        True,
    ),
)


UNAVAILABLE_REASONS = {
    "test_coverage": "No machine-readable line and branch coverage measurement was supplied; test or workflow presence is not coverage.",
    "security_and_supply_chain": "No current security and supply-chain assessment was supplied; guardrail-file presence is not verification.",
    "ci_and_release_readiness": "No current hosted-CI and immutable-release result was supplied; workflow-file presence is not release proof.",
    "runtime_efficiency": "No registered latency, throughput, and resource measurement was supplied; source size and runtime-stack presence are not performance evidence.",
}
SCHEMA_COMPATIBILITY = {
    "previous_schema": "uok.quality_scorecard.v1",
    "overall_score_alias": "repository_conformance.score",
    "grade_alias": "repository_conformance.grade",
}
LIMITATIONS = (
    "This scorecard measures repository conformance, not engineering maturity or production readiness.",
    "Static repository-control categories are capped below 100 even when every presence check passes.",
    "Unavailable categories are excluded from overall_score and must not be interpreted as passing.",
    "Test and workflow presence is never interpreted as test coverage, security verification, or release proof.",
)
REPEATABILITY = {
    "control_only_command": "powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\uok_ops.ps1 -Action EngineeringEvidence",
    "measurement_build_command": "python scripts/build_engineering_measurements.py",
    "measured_evidence_command": (
        "python scripts/engineering_evidence.py --measurements "
        "var/evidence/engineering/uok_engineering_measurements_v2.json --stdout"
    ),
    "ci_evidence_command": (
        "python scripts/engineering_evidence.py --measurements "
        "var/evidence/engineering/uok_engineering_measurements_v2.json "
        "--output var/evidence/engineering/uok_engineering_ci.json"
    ),
    "publish_gate": "TechnologyAudit, Verify, EngineeringEvidence, GithubReadiness, and GithubPrChecks",
}

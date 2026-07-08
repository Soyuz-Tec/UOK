from __future__ import annotations

from dataclasses import dataclass
from typing import Any


GRADE_THRESHOLDS = (
    (95, "A"),
    (85, "B"),
    (75, "C"),
    (65, "D"),
)


@dataclass(frozen=True)
class ScoreCategory:
    name: str
    score: int
    evidence: list[str]
    improvement: str


CategoryDefinition = tuple[str, list[str], str]


CATEGORY_DEFINITIONS: tuple[CategoryDefinition, ...] = (
    (
        "correctness",
        ["required_artifacts", "runtime_stack", "module_shape"],
        "Run the full Verify gate when behavior changed.",
    ),
    (
        "test_coverage",
        ["required_artifacts", "github_guardrails"],
        "Add focused tests or verifier evidence for uncovered behavior.",
    ),
    (
        "split_quality",
        ["source_size", "operations_hygiene"],
        "Split oversized or mixed-responsibility files before expansion.",
    ),
    (
        "reuse_and_boundaries",
        ["module_shape", "operations_hygiene"],
        "Move repeated UI or workflow behavior into the smallest shared owner.",
    ),
    (
        "module_discipline",
        ["module_shape", "runtime_stack"],
        "Keep module behavior in manifests, module folders, and module tests.",
    ),
    (
        "ui_consistency",
        ["frontend_stack", "required_artifacts"],
        "Keep durable UI in React, TypeScript, generated contracts, and policy docs.",
    ),
    (
        "runtime_efficiency",
        ["runtime_stack", "source_size"],
        "Prefer paginated, indexed, typed, and bounded workflows.",
    ),
    (
        "security_and_supply_chain",
        ["github_guardrails", "python_stack", "frontend_stack"],
        "Keep dependencies pinned, audits clean, and GitHub checks passing.",
    ),
    (
        "documentation",
        ["required_artifacts", "operations_hygiene", "internal_engineering_system"],
        "Update owning Markdown artifacts with behavior and policy changes.",
    ),
    (
        "ci_and_release_readiness",
        ["github_guardrails", "runtime_stack", "operations_hygiene"],
        "Use GitHub readiness and PR checks before publication.",
    ),
)


def _check_map(audit_report: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        str(check["name"]): {
            "ok": bool(check["ok"]),
            "details": str(check.get("details", "")),
        }
        for check in audit_report.get("checks", [])
        if "name" in check
    }


def _check_score(checks: dict[str, dict[str, Any]], name: str) -> int:
    check = checks.get(name, {"ok": False, "details": ""})
    if not check["ok"]:
        return 0
    if name == "source_size" and "soft:" in check["details"]:
        return 75
    return 100


def _score(checks: dict[str, dict[str, Any]], required: list[str]) -> int:
    if not required:
        return 0
    return round(sum(_check_score(checks, name) for name in required) / len(required))


def _evidence(checks: dict[str, dict[str, Any]], required: list[str]) -> list[str]:
    evidence: list[str] = []
    for name in required:
        score = _check_score(checks, name)
        status = "pass" if score == 100 else "review" if score else "fail"
        evidence.append(f"{name}: {status}")
    return evidence


def _grade(score: int) -> str:
    for threshold, grade in GRADE_THRESHOLDS:
        if score >= threshold:
            return grade
    return "F"


def _category(definition: CategoryDefinition, checks: dict[str, dict[str, Any]]) -> ScoreCategory:
    name, required, improvement = definition
    return ScoreCategory(
        name=name,
        score=_score(checks, required),
        evidence=_evidence(checks, required),
        improvement=improvement,
    )


def build_scorecard(audit_report: dict[str, Any]) -> dict[str, Any]:
    checks = _check_map(audit_report)
    scored = [_category(definition, checks) for definition in CATEGORY_DEFINITIONS]
    overall = round(sum(category.score for category in scored) / len(scored))
    return {
        "schema": "uok.quality_scorecard.v1",
        "overall_score": overall,
        "grade": _grade(overall),
        "quality_audit_ok": bool(audit_report.get("ok")),
        "categories": [category.__dict__ for category in scored],
        "repeatability": {
            "local_command": (
                "powershell -NoProfile -ExecutionPolicy Bypass -File "
                ".\\scripts\\uok_ops.ps1 -Action EngineeringEvidence"
            ),
            "ci_gate": "python scripts/engineering_evidence.py --stdout",
            "publish_gate": (
                "TechnologyAudit, Verify, EngineeringEvidence, "
                "GithubReadiness, and GithubPrChecks"
            ),
        },
    }

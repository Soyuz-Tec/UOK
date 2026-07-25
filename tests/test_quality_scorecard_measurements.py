from __future__ import annotations

import sys
from pathlib import Path

import pytest


SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import quality_scorecard  # noqa: E402


def _audit() -> dict[str, object]:
    names = (
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
    return {
        "ok": True,
        "checks": [{"name": name, "ok": True, "details": "pass"} for name in names],
    }


def test_verified_coverage_score_is_derived_from_artifact_totals(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    measurements = {
        "schema": "uok.engineering_measurements.v2",
        "repository": {
            "origin": "https://example.invalid/UOK.git",
            "head": "a" * 40,
            "worktree": "clean",
        },
        "observed_at": "2026-07-24T12:00:00Z",
        "categories": {
            "test_coverage": {
                "status": "measured",
                "method": "coverage_combined_v2",
                "sources": [
                    {
                        "name": "python",
                        "path": "var/evidence/coverage/python/coverage.json",
                        "sha256": "b" * 64,
                        "bytes": 10,
                        "media_type": "application/json",
                    },
                    {
                        "name": "frontend",
                        "path": "var/evidence/coverage/frontend/coverage-summary.json",
                        "sha256": "c" * 64,
                        "bytes": 10,
                        "media_type": "application/json",
                    },
                ],
                "provenance": [
                    {
                        "name": "python",
                        "path": "var/evidence/coverage/python/provenance.json",
                        "sha256": "d" * 64,
                        "bytes": 10,
                        "media_type": "application/json",
                    },
                    {
                        "name": "frontend",
                        "path": "var/evidence/coverage/frontend/provenance.json",
                        "sha256": "e" * 64,
                        "bytes": 10,
                        "media_type": "application/json",
                    },
                ],
                "metrics": {
                    "python": {
                        "inventory": {"file_count": 1, "files": ["src/uok/a.py"]},
                        "lines": {"covered": 42, "total": 50},
                        "branches": {"covered": 40, "total": 50},
                    },
                    "frontend": {
                        "inventory": {"file_count": 1, "files": ["web/src/a.ts"]},
                        "lines": {"covered": 42, "total": 50},
                        "branches": {"covered": 40, "total": 50},
                    },
                    "combined": {
                        "lines": {"covered": 84, "total": 100},
                        "branches": {"covered": 80, "total": 100},
                    },
                },
            },
            "runtime_efficiency": {
                "status": "unavailable",
                "reason": (
                    "No registered local method verifies latency, throughput, "
                    "and resource-consumption outcomes."
                ),
            },
            "security_and_supply_chain": {
                "status": "unavailable",
                "reason": (
                    "No registered local method verifies security and "
                    "supply-chain outcomes."
                ),
            },
            "ci_and_release_readiness": {
                "status": "unavailable",
                "reason": (
                    "No registered local method verifies hosted CI and "
                    "immutable release outcomes."
                ),
            },
        },
    }
    monkeypatch.setattr(
        quality_scorecard.engineering_measurements,
        "validate_measurements",
        lambda payload, root: payload,
    )

    scorecard = quality_scorecard.build_scorecard(_audit(), measurements=measurements)
    by_name = {item["name"]: item for item in scorecard["categories"]}
    coverage = by_name["test_coverage"]

    assert coverage["status"] == "measured"
    assert coverage["score"] == 82
    assert coverage["metrics"]["combined"]["lines"]["covered"] == 84
    assert "source: var/evidence/coverage/python/coverage.json" in coverage["evidence"]
    assert by_name["security_and_supply_chain"]["score"] is None
    assert by_name["runtime_efficiency"]["metrics"] == {}
    assert scorecard["repository_conformance"]["evidence_completeness_percent"] == 70
    assert scorecard["measurement_evidence"]["schema"] == (
        "uok.engineering_measurements.v2"
    )


def test_unverified_self_attestation_is_rejected() -> None:
    claimed = {
        "schema": "uok.engineering_measurements.v1",
        "repository": {},
        "observed_at": "2026-07-24T12:00:00Z",
        "categories": {},
    }

    with pytest.raises(
        quality_scorecard.engineering_measurements.MeasurementValidationError,
        match="measurement schema",
    ):
        quality_scorecard.build_scorecard(_audit(), measurements=claimed)

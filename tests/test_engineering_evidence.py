from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest


SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import engineering_evidence  # noqa: E402


def test_engineering_evidence_uses_v2_envelope_and_exposes_trend_metrics(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    git_values = {
        ("status", "--short"): "",
        ("branch", "--show-current"): "feat/evidence",
        ("rev-parse", "HEAD"): "a" * 40,
        ("remote", "get-url", "origin"): "https://example.invalid/UOK.git",
    }
    monkeypatch.setattr(
        engineering_evidence,
        "run_git",
        lambda args: git_values[tuple(args)],
    )
    monkeypatch.setattr(
        engineering_evidence,
        "quality_report",
        lambda: {
            "ok": True,
            "checks": [
                {"name": "required_artifacts", "ok": True, "details": "present"},
                {
                    "name": "source_size",
                    "ok": True,
                    "details": "structured report supplied",
                },
            ],
        },
    )
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
            "resolved_count": 0,
            "baseline_count": 2,
            "current_count": 2,
        },
    }
    monkeypatch.setattr(
        engineering_evidence,
        "source_size_report",
        lambda: source_size,
    )

    evidence = engineering_evidence.build_evidence()

    assert evidence["schema"] == "uok.engineering_evidence.v2"
    assert evidence["schema_compatibility"]["previous_schema"] == (
        "uok.engineering_evidence.v1"
    )
    assert evidence["schema_compatibility"]["migration"].endswith(
        "UOK_ENGINEERING_EVIDENCE_V2_MIGRATION.md"
    )
    assert evidence["evidence_scope"]["not_a_maturity_rating"] is True
    assert evidence["quality_scorecard"]["schema"] == "uok.quality_scorecard.v2"
    assert evidence["repository_conformance"]["status"] == "partial"
    assert (
        evidence["source_size_policy"]["soft_findings"] == source_size["soft_findings"]
    )
    assert evidence["trend_metrics"]["source_size"]["soft_warning_count"] == 2
    assert evidence["trend_metrics"]["source_size"]["soft_affected_path_count"] == 2
    assert (
        evidence["measurements"]["categories"]["test_coverage"]["status"]
        == "unavailable"
    )


def test_measurement_file_rejects_retired_v1_schema(tmp_path: Path) -> None:
    invalid_path = tmp_path / "invalid.json"
    invalid_path.write_text(
        json.dumps(
            {
                "schema": "uok.engineering_measurements.v1",
                "repository": {},
                "observed_at": "2026-07-24T12:00:00Z",
                "categories": {},
            }
        ),
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="measurement schema"):
        engineering_evidence.load_measurements(invalid_path)


def test_measurement_loader_uses_fail_closed_v2_validator(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    path = tmp_path / "measurements.json"
    path.write_text("{}", encoding="utf-8")
    expected = {"schema": "uok.engineering_measurements.v2"}
    calls: list[tuple[Path, Path]] = []

    def fake_load(input_path: Path, root: Path) -> dict[str, str]:
        calls.append((input_path, root))
        return expected

    monkeypatch.setattr(
        engineering_evidence.engineering_measurements,
        "load_measurements",
        fake_load,
    )

    assert engineering_evidence.load_measurements(path, tmp_path) == expected
    assert calls == [(path, tmp_path)]

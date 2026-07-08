from __future__ import annotations

import sys
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import quality_audit  # noqa: E402
import quality_scorecard  # noqa: E402


def test_quality_scorecard_is_repeatable_and_complete() -> None:
    audit = {
        "ok": True,
        "checks": [result.__dict__ for result in quality_audit.run_checks()],
    }

    scorecard = quality_scorecard.build_scorecard(audit)

    assert scorecard["schema"] == "uok.quality_scorecard.v1"
    assert scorecard["quality_audit_ok"] is True
    assert 0 <= scorecard["overall_score"] <= 100
    assert len(scorecard["categories"]) == 10
    assert all(0 <= category["score"] <= 100 for category in scorecard["categories"])
    source_size_evidence = [
        evidence
        for category in scorecard["categories"]
        for evidence in category["evidence"]
        if evidence.startswith("source_size:")
    ]
    assert source_size_evidence
    assert all(evidence in {"source_size: pass", "source_size: review"} for evidence in source_size_evidence)
    assert "EngineeringEvidence" in scorecard["repeatability"]["local_command"]

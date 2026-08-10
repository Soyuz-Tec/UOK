from __future__ import annotations

import json
import sys
from datetime import date, timedelta
from pathlib import Path

import pytest


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import source_size_policy as policy  # noqa: E402


TODAY = date(2026, 7, 25)
IDENTITY = "function:src/example.py::work"


def _function_source(lines: int = 70) -> str:
    return "\n".join(["def work():", *(["    pass"] * (lines - 1))]) + "\n"


def _source(repo: Path, lines: int = 70) -> None:
    path = repo / "src/example.py"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(_function_source(lines), encoding="utf-8")


def _exception(
    max_lines: int = 80, *, expires_on: date | None = None
) -> dict[str, object]:
    return {
        "identity": IDENTITY,
        "kind": "function",
        "path": "src/example.py",
        "symbol": "work",
        "max_lines": max_lines,
        "owner": "@Soyuz-Tec",
        "reason": "Temporary bounded refactor debt with an exact owner.",
        "issue": "https://github.com/Soyuz-Tec/UOK/issues/123",
        "expires_on": (expires_on or TODAY + timedelta(days=30)).isoformat(),
    }


def _write_config(
    repo: Path,
    *,
    baseline: list[dict[str, object]] | None = None,
    exceptions: list[dict[str, object]] | None = None,
) -> Path:
    path = repo / "config/source_size_policy.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "schema": "uok.source_size_policy.v1",
        "baseline": baseline or [],
        "exceptions": exceptions or [],
    }
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return path


def _baseline(max_lines: int = 70) -> list[dict[str, object]]:
    return [{"identity": IDENTITY, "max_lines": max_lines}]


def _rules(report: dict[str, object]) -> list[str]:
    return [str(item["rule"]) for item in report["hard_findings"]]


def test_missing_configuration_fails_without_hiding_scan_results(
    tmp_path: Path,
) -> None:
    _source(tmp_path)

    report = policy.run_source_size_policy(tmp_path, today=TODAY)

    assert report["ok"] is False
    assert report["soft_count"] == 1
    assert report["ratchet"]["status"] == "not_evaluated"
    assert _rules(report) == ["configuration_invalid"]


def test_exact_baseline_is_clean_and_preserves_soft_debt(tmp_path: Path) -> None:
    _source(tmp_path)
    config = _write_config(tmp_path, baseline=_baseline())

    report = policy.run_source_size_policy(tmp_path, config_path=config, today=TODAY)

    assert report["ok"] is True
    assert report["hard_count"] == 0
    assert report["soft_count"] == 1
    assert report["ratchet"] == {
        "status": "clean",
        "new_count": 0,
        "growth_count": 0,
        "resolved_count": 0,
        "baseline_count": 1,
        "current_count": 1,
    }


def test_new_soft_debt_fails_the_ratchet(tmp_path: Path) -> None:
    _source(tmp_path)
    config = _write_config(tmp_path)

    report = policy.run_source_size_policy(tmp_path, config_path=config, today=TODAY)

    assert report["ok"] is False
    assert report["ratchet"]["new_count"] == 1
    assert _rules(report) == ["ratchet_new"]


def test_growth_above_baseline_fails_the_ratchet(tmp_path: Path) -> None:
    _source(tmp_path)
    config = _write_config(tmp_path, baseline=_baseline(65))

    report = policy.run_source_size_policy(tmp_path, config_path=config, today=TODAY)

    assert report["ratchet"]["growth_count"] == 1
    assert _rules(report) == ["ratchet_growth"]
    assert report["hard_findings"][0]["threshold"] == 65


def test_resolved_soft_debt_requires_baseline_cleanup(tmp_path: Path) -> None:
    config = _write_config(tmp_path, baseline=_baseline())

    report = policy.run_source_size_policy(tmp_path, config_path=config, today=TODAY)

    assert report["ratchet"]["status"] == "baseline_update_required"
    assert report["ratchet"]["resolved_count"] == 1
    assert _rules(report) == ["ratchet_resolved"]


def test_exact_exception_can_temporarily_cover_ratchet_growth(tmp_path: Path) -> None:
    _source(tmp_path)
    config = _write_config(
        tmp_path,
        baseline=_baseline(65),
        exceptions=[_exception()],
    )

    report = policy.run_source_size_policy(tmp_path, config_path=config, today=TODAY)

    assert report["ok"] is True
    assert report["hard_count"] == 0
    assert report["active_exception_count"] == 1
    assert report["ratchet"]["growth_count"] == 1
    assert report["active_exceptions"][0]["identity"] == IDENTITY


def test_exception_below_current_size_is_unused_and_does_not_hide_growth(
    tmp_path: Path,
) -> None:
    _source(tmp_path)
    config = _write_config(
        tmp_path,
        baseline=_baseline(65),
        exceptions=[_exception(68)],
    )

    report = policy.run_source_size_policy(tmp_path, config_path=config, today=TODAY)

    assert report["ok"] is False
    assert report["active_exception_count"] == 0
    assert _rules(report) == ["exception_unused", "ratchet_growth"]


def test_baseline_builder_is_sorted_and_refuses_hard_findings(tmp_path: Path) -> None:
    _source(tmp_path)
    second = tmp_path / "web/src/large.ts"
    second.parent.mkdir(parents=True)
    second.write_text("\n".join(["x"] * 251) + "\n", encoding="utf-8")

    payload = policy.build_baseline_payload(tmp_path)

    identities = [item["identity"] for item in payload["baseline"]]
    assert identities == sorted(identities)
    assert payload["exceptions"] == []

    _source(tmp_path, 121)
    with pytest.raises(ValueError, match="hard findings"):
        policy.build_baseline_payload(tmp_path)

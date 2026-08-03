from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import quality_audit  # noqa: E402
import source_size_policy  # noqa: E402


def _finding(index: int, severity: str = "soft") -> dict[str, object]:
    return {
        "path": f"src/example_{index}.py",
        "lines": 201 + index,
        "threshold": 200,
        "severity": severity,
        "reason": "file exceeds soft review threshold",
    }


def _report(
    *,
    hard: list[dict[str, object]] | None = None,
    soft: list[dict[str, object]] | None = None,
) -> dict[str, object]:
    hard_findings = hard or []
    soft_findings = soft or []
    return {
        "schema": "uok.source_size_report.v1",
        "ok": not hard_findings,
        "scanned_file_count": 17,
        "hard_count": len(hard_findings),
        "soft_count": len(soft_findings),
        "active_exception_count": 0,
        "hard_findings": hard_findings,
        "soft_findings": soft_findings,
        "ratchet": {
            "status": "clean",
            "new_count": 0,
            "growth_count": 0,
            "resolved_count": 0,
            "baseline_count": len(soft_findings),
            "current_count": len(soft_findings),
        },
    }


def test_empty_summary_keeps_existing_success_message() -> None:
    assert (
        source_size_policy.summarize_source_size_policy(_report())
        == "within hard limits; no soft warnings"
    )


def test_soft_summary_reports_truncation_counts() -> None:
    report = _report(soft=[_finding(index) for index in range(14)])

    summary = source_size_policy.summarize_source_size_policy(report)

    assert "soft [total=14 shown=12 omitted=2]:" in summary
    assert "src/example_11.py" in summary
    assert "src/example_12.py" not in summary


def test_hard_and_soft_groups_keep_independent_counts_and_semantics() -> None:
    report = _report(
        hard=[_finding(0, "hard")],
        soft=[_finding(index) for index in range(3)],
    )

    summary = source_size_policy.summarize_source_size_policy(report, limit=2)

    assert summary.startswith("hard [total=1 shown=1 omitted=0]:")
    assert " | soft [total=3 shown=2 omitted=1]:" in summary


def test_zero_limit_still_discloses_all_omitted_findings() -> None:
    summary = source_size_policy.summarize_source_size_policy(
        _report(soft=[_finding(0), _finding(1)]),
        limit=0,
    )

    assert summary == "soft [total=2 shown=0 omitted=2]"


def test_quality_audit_surfaces_the_source_size_marker(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    report = _report(soft=[_finding(index) for index in range(13)])
    monkeypatch.setattr(
        quality_audit.source_size_policy,
        "run_source_size_policy",
        lambda _root: report,
    )

    result = quality_audit.check_source_size()

    assert result.ok is True
    assert "soft [total=13 shown=12 omitted=1]:" in result.details


def test_cli_defaults_to_one_line_and_full_json_is_opt_in(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    report = _report(soft=[_finding(index) for index in range(14)])
    monkeypatch.setattr(
        source_size_policy,
        "run_source_size_policy",
        lambda _root, config_path=None: report,
    )

    assert source_size_policy.main(["--repo-root", str(ROOT)]) == 0
    concise = capsys.readouterr().out.strip()
    assert concise.startswith(
        "source-size policy PASS: scanned=17 hard=0 soft=14 exceptions=0;"
    )
    assert concise.count("\n") == 0
    assert "src/example_0.py" not in concise

    assert source_size_policy.main(["--repo-root", str(ROOT), "--json"]) == 0
    assert json.loads(capsys.readouterr().out) == report


def test_cli_failure_details_are_bounded(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    report = _report(hard=[_finding(index, "hard") for index in range(7)])
    monkeypatch.setattr(
        source_size_policy,
        "run_source_size_policy",
        lambda _root, config_path=None: report,
    )

    assert source_size_policy.main(["--repo-root", str(ROOT)]) == 1
    output = capsys.readouterr().out
    assert "source-size policy FAIL:" in output
    assert "blocking [total=7 shown=5 omitted=2]:" in output
    assert "src/example_4.py" in output
    assert "src/example_5.py" not in output


def test_cli_prints_report_and_read_only_baseline_json(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    source = tmp_path / "src/example.py"
    source.parent.mkdir(parents=True)
    source.write_text(
        "\n".join(["def work():", *(["    pass"] * 69)]) + "\n",
        encoding="utf-8",
    )
    config = tmp_path / "config/source_size_policy.json"
    config.parent.mkdir(parents=True)
    config.write_text(
        json.dumps(
            {
                "schema": "uok.source_size_policy.v1",
                "baseline": [
                    {
                        "identity": "function:src/example.py::work",
                        "max_lines": 70,
                    }
                ],
                "exceptions": [],
            }
        ),
        encoding="utf-8",
    )

    arguments = [
        "--repo-root",
        str(tmp_path),
        "--config",
        str(config),
        "--json",
    ]
    assert source_size_policy.main(arguments) == 0
    report = json.loads(capsys.readouterr().out)
    assert report["schema"] == "uok.source_size_report.v1"

    assert (
        source_size_policy.main(["--repo-root", str(tmp_path), "--print-baseline"]) == 0
    )
    baseline = json.loads(capsys.readouterr().out)
    assert baseline["schema"] == "uok.source_size_policy.v1"
    assert config.read_text(encoding="utf-8")

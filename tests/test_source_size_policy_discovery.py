from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import source_size_rules as rules  # noqa: E402


def _write_lines(path: Path, count: int, value: str = "x") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join([value] * count) + "\n", encoding="utf-8")


def _function_source(lines: int, name: str = "work") -> str:
    return "\n".join([f"def {name}():", *(["    pass"] * (lines - 1))]) + "\n"


def _rules(analysis: rules.SourceAnalysis, severity: str) -> set[str]:
    findings = analysis.hard if severity == "hard" else analysis.soft
    return {item.rule for item in findings}


def test_discovery_covers_deploy_web_configs_e2e_and_conftest(
    tmp_path: Path,
) -> None:
    _write_lines(tmp_path / "deploy/postgres/policy.sql", 1, "select 1;")
    _write_lines(tmp_path / "web/vite.config.ts", 1, "export {};")
    _write_lines(tmp_path / "web/e2e/proof.spec.ts", 1, "export {};")
    _write_lines(tmp_path / "conftest.py", 1, "VALUE = 1")
    _write_lines(tmp_path / "root_tool.py", 1, "VALUE = 1")

    analysis = rules.analyze_source_size(tmp_path)

    assert analysis.scanned_file_count == 5
    assert not analysis.hard
    assert not analysis.soft


def test_exact_generated_exclusions_do_not_hide_similarly_named_source(
    tmp_path: Path,
) -> None:
    _write_lines(tmp_path / "web/src/generated/ignored.ts", 400)
    _write_lines(tmp_path / "web/src/generator/scanned.ts", 301)
    _write_lines(tmp_path / "src/uok/static/app/ignored.css", 400)

    analysis = rules.analyze_source_size(tmp_path)

    assert analysis.scanned_file_count == 1
    assert [item.path for item in analysis.hard] == ["web/src/generator/scanned.ts"]
    assert _rules(analysis, "hard") == {"file_hard_300"}


def test_file_thresholds_are_strictly_greater_than_limits(tmp_path: Path) -> None:
    _write_lines(tmp_path / "web/src/useAtLimit.ts", 200)
    _write_lines(tmp_path / "web/src/general.ts", 250)
    _write_lines(tmp_path / "web/src/over.ts", 301)

    analysis = rules.analyze_source_size(tmp_path)

    assert {item.path for item in analysis.soft} == {"web/src/over.ts"}
    assert {item.path for item in analysis.hard} == {"web/src/over.ts"}


def test_python_functions_use_stable_qualified_identities(tmp_path: Path) -> None:
    source = "\n".join(
        [
            "class Example:",
            "    def method(self):",
            "        def nested():",
            *(["            pass"] * 61),
            "        return nested",
        ]
    )
    path = tmp_path / "src/example.py"
    path.parent.mkdir(parents=True)
    path.write_text(source + "\n", encoding="utf-8")

    analysis = rules.analyze_source_size(tmp_path)

    identities = {item.identity for item in analysis.soft}
    assert "function:src/example.py::Example.method" in identities
    assert "function:src/example.py::Example.method.<locals>.nested" in identities
    assert all(":2" not in identity for identity in identities)


def test_python_function_soft_and_hard_limits(tmp_path: Path) -> None:
    path = tmp_path / "src/example.py"
    path.parent.mkdir(parents=True)
    path.write_text(_function_source(121), encoding="utf-8")

    analysis = rules.analyze_source_size(tmp_path)

    assert _rules(analysis, "soft") == {"function_soft_60"}
    assert _rules(analysis, "hard") == {"function_hard_120"}
    finding = analysis.hard[0]
    assert finding.identity == "function:src/example.py::work"
    assert finding.lines == 121


def test_invalid_utf8_and_python_syntax_fail_closed(tmp_path: Path) -> None:
    invalid_utf8 = tmp_path / "src/invalid.py"
    invalid_utf8.parent.mkdir(parents=True)
    invalid_utf8.write_bytes(b"\xff")
    (tmp_path / "src/syntax.py").write_text("def broken(:\n", encoding="utf-8")

    analysis = rules.analyze_source_size(tmp_path)

    assert _rules(analysis, "hard") == {"source_utf8", "python_parse"}


def test_source_file_symlink_is_rejected(tmp_path: Path) -> None:
    target = tmp_path / "outside/target.py"
    target.parent.mkdir()
    target.write_text("VALUE = 1\n", encoding="utf-8")
    link = tmp_path / "src/linked.py"
    link.parent.mkdir(parents=True)
    try:
        os.symlink(target, link)
    except OSError as exc:
        pytest.skip(f"symlink creation is unavailable: {exc}")

    analysis = rules.analyze_source_size(tmp_path)

    assert _rules(analysis, "hard") == {"source_symlink"}
    assert analysis.hard[0].identity == "symlink:src/linked.py"
    assert analysis.scanned_file_count == 0


def test_source_directory_symlink_is_rejected(tmp_path: Path) -> None:
    target = tmp_path / "outside"
    target.mkdir()
    (target / "example.py").write_text("VALUE = 1\n", encoding="utf-8")
    link = tmp_path / "src/linked"
    link.parent.mkdir(parents=True)
    try:
        os.symlink(target, link, target_is_directory=True)
    except OSError as exc:
        pytest.skip(f"directory symlink creation is unavailable: {exc}")

    analysis = rules.analyze_source_size(tmp_path)

    assert _rules(analysis, "hard") == {"source_symlink"}
    assert analysis.hard[0].identity == "symlink:src/linked"
    assert analysis.scanned_file_count == 0


def test_repository_root_source_symlink_is_rejected(tmp_path: Path) -> None:
    target = tmp_path / "outside/target.py"
    target.parent.mkdir()
    target.write_text("VALUE = 1\n", encoding="utf-8")
    link = tmp_path / "linked.py"
    try:
        os.symlink(target, link)
    except OSError as exc:
        pytest.skip(f"symlink creation is unavailable: {exc}")

    analysis = rules.analyze_source_size(tmp_path)

    assert _rules(analysis, "hard") == {"source_symlink"}
    assert analysis.hard[0].identity == "symlink:linked.py"
    assert analysis.scanned_file_count == 0


def test_whole_source_root_symlink_is_rejected(tmp_path: Path) -> None:
    target = tmp_path / "outside"
    target.mkdir()
    (target / "target.py").write_text("VALUE = 1\n", encoding="utf-8")
    link = tmp_path / "src"
    try:
        os.symlink(target, link, target_is_directory=True)
    except OSError as exc:
        pytest.skip(f"directory symlink creation is unavailable: {exc}")

    analysis = rules.analyze_source_size(tmp_path)

    assert _rules(analysis, "hard") == {"source_symlink"}
    assert analysis.hard[0].identity == "symlink:src"
    assert analysis.scanned_file_count == 0

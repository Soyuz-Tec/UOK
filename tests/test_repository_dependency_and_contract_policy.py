from __future__ import annotations

import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import check_generated_contracts  # noqa: E402
import dependency_policy  # noqa: E402
import quality_audit  # noqa: E402


def test_python_runtime_and_development_dependency_layers_are_aligned() -> None:
    assert dependency_policy.validate_dependency_policy(ROOT) == []
    assert quality_audit.check_python_stack().ok is True

    runtime = (ROOT / "requirements.txt").read_text(encoding="utf-8")
    development = (ROOT / "requirements-dev.txt").read_text(encoding="utf-8")
    for dev_only_name in ("pytest==", "httpx2==", "pip-audit=="):
        assert dev_only_name not in runtime
        assert dev_only_name in development
    assert "-r requirements.txt" in development


def test_dependency_policy_rejects_non_exact_requirement_forms() -> None:
    problems = dependency_policy._pin_problems(
        {"valid[extra]==1.2.3", "wildcard==*", "range>=1==2", "direct @ https://example.invalid/pkg"},
        "test",
    )

    assert problems == [
        "unpinned test dependency: direct @ https://example.invalid/pkg",
        "unpinned test dependency: range>=1==2",
        "unpinned test dependency: wildcard==*",
    ]


def test_scorecard_publish_permission_is_job_scoped() -> None:
    lines = (ROOT / ".github/workflows/uok-openssf-scorecard.yml").read_text(
        encoding="utf-8",
    ).splitlines()

    assert "  id-token: write" not in lines
    assert "      id-token: write" in lines


def test_checked_openapi_json_matches_the_runtime_schema() -> None:
    expected = check_generated_contracts.render_runtime_openapi()
    assert check_generated_contracts.contract_drift(
        expected,
        check_generated_contracts.OPENAPI_PATH,
    ) is None


def test_runtime_openapi_render_disables_import_bootstrap(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("UOK_BOOTSTRAP_ON_IMPORT", "1")

    check_generated_contracts.render_runtime_openapi()

    assert check_generated_contracts.os.environ["UOK_BOOTSTRAP_ON_IMPORT"] == "0"


def test_contract_generator_requires_the_installed_locked_tool(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(check_generated_contracts, "WEB_ROOT", tmp_path)
    monkeypatch.setattr(check_generated_contracts.shutil, "which", lambda executable: "node")

    with pytest.raises(RuntimeError, match="installed openapi-typescript is required"):
        check_generated_contracts.generate_typescript_contract(
            tmp_path / "openapi.json",
            tmp_path / "openapi.d.ts",
        )


def test_generated_contract_drift_reports_the_changed_artifact(tmp_path: Path) -> None:
    checked = tmp_path / "openapi.json"
    checked.write_text("{}", encoding="utf-8")

    problem = check_generated_contracts.contract_drift('{"changed": true}', checked)

    assert problem is not None
    assert checked.as_posix() in problem
    assert "drifted" in problem
    assert "expected sha256:" in problem


def test_generated_contract_drift_reports_a_missing_artifact(tmp_path: Path) -> None:
    missing = tmp_path / "openapi.d.ts"

    problem = check_generated_contracts.contract_drift("expected", missing)

    assert problem == f"missing generated contract: {missing.as_posix()}"

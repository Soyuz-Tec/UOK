from __future__ import annotations

import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

import uok.candidate_verifier_catalog as verifier_catalog  # noqa: E402


def _write_manifest(
    module_root: Path,
    name: str,
    *,
    required: bool = False,
    dependencies: tuple[str, ...] = (),
    function: str | None = None,
    script: str | None = None,
    defined_function: str | None = None,
    script_content: str | None = None,
) -> None:
    module_dir = module_root / name
    verify_dir = module_dir / "verify"
    verify_dir.mkdir(parents=True)
    if script:
        candidate = module_root.parent / Path(*script.split("/"))
        candidate.parent.mkdir(parents=True, exist_ok=True)
        candidate.write_text(
            script_content or f"function {defined_function or function} {{}}\n",
            encoding="utf-8",
        )
    dependency_lines = "\n".join(f"  - {dependency}" for dependency in dependencies)
    verifier_fields = ""
    extensions = ""
    if function and script:
        verifier_fields = (
            f"candidate_verifier_script: {script}\n"
            f"candidate_verifier_function: {function}\n"
        )
        extensions = "  - candidate_verifier\n"
    manifest = f"""manifest_schema: uok.module.v1
name: {name}
kind: capability_module
version: APP_VERSION
description: "Test module"
maturity: source_present
installable: true
uninstallable: true
updatable: true
maintainable: true
required: {str(required).lower()}
lifecycle:
  - available
commands:
events:
dependencies:
{dependency_lines}
backend_path: modules/{name}/backend
web_path: modules/{name}/web
migrations_path: modules/{name}/migrations
tests_path: modules/{name}/tests
api_prefixes:
permissions:
owned_tables:
{verifier_fields}extension_points:
{extensions}data_retention_policy: "Test retention"
"""
    (module_dir / "manifest.yaml").write_text(manifest, encoding="utf-8")


@pytest.fixture
def valid_release_contract(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        verifier_catalog,
        "validate_module_release_contracts",
        lambda _root: {"ok": True, "violations": []},
    )


def test_catalog_orders_required_and_dependency_verifiers(
    tmp_path: Path, valid_release_contract: None
) -> None:
    module_root = tmp_path / "modules"
    _write_manifest(
        module_root,
        "apps.manager",
        required=True,
        function="Invoke-UokApps",
        script="modules/apps.manager/verify/UokCandidateApps.ps1",
    )
    _write_manifest(
        module_root,
        "planning.core",
        dependencies=("calendar.core",),
        function="Invoke-UokPlanning",
        script="modules/planning.core/verify/UokCandidatePlanning.ps1",
    )
    _write_manifest(
        module_root,
        "calendar.core",
        function="Invoke-UokCalendar",
        script="modules/calendar.core/verify/UokCandidateCalendar.ps1",
    )

    catalog = verifier_catalog.candidate_verifier_catalog(module_root)

    assert [entry["name"] for entry in catalog] == [
        "apps.manager",
        "calendar.core",
        "planning.core",
    ]
    assert all(set(entry) == {"name", "script", "function"} for entry in catalog)


def test_catalog_rejects_test_owned_verifier_path(
    tmp_path: Path, valid_release_contract: None
) -> None:
    module_root = tmp_path / "modules"
    _write_manifest(module_root, "apps.manager", required=True)
    _write_manifest(
        module_root,
        "planning.core",
        function="Invoke-UokPlanning",
        script="modules/planning.core/tests/verify/UokCandidatePlanning.ps1",
    )

    with pytest.raises(
        verifier_catalog.CandidateVerifierCatalogError,
        match=r"modules/planning\.core/verify",
    ):
        verifier_catalog.candidate_verifier_catalog(module_root)


def test_catalog_rejects_duplicate_case_insensitive_function_names(
    tmp_path: Path, valid_release_contract: None
) -> None:
    module_root = tmp_path / "modules"
    _write_manifest(module_root, "apps.manager", required=True)
    _write_manifest(
        module_root,
        "calendar.core",
        function="Invoke-UokCandidate",
        script="modules/calendar.core/verify/UokCandidateCalendar.ps1",
    )
    _write_manifest(
        module_root,
        "planning.core",
        function="invoke-uokcandidate",
        script="modules/planning.core/verify/UokCandidatePlanning.ps1",
    )

    with pytest.raises(
        verifier_catalog.CandidateVerifierCatalogError,
        match="function invoke-uokcandidate is shared",
    ):
        verifier_catalog.candidate_verifier_catalog(module_root)


def test_catalog_rejects_script_missing_declared_function(
    tmp_path: Path, valid_release_contract: None
) -> None:
    module_root = tmp_path / "modules"
    _write_manifest(module_root, "apps.manager", required=True)
    _write_manifest(
        module_root,
        "calendar.core",
        function="Invoke-UokCalendar",
        defined_function="Invoke-UokDifferentFunction",
        script="modules/calendar.core/verify/UokCandidateCalendar.ps1",
    )

    with pytest.raises(
        verifier_catalog.CandidateVerifierCatalogError,
        match="script does not define Invoke-UokCalendar",
    ):
        verifier_catalog.candidate_verifier_catalog(module_root)


@pytest.mark.parametrize(
    "script_content",
    (
        "<# function Invoke-UokCalendar {} #>\n",
        "if ($false) { function Invoke-UokCalendar {} }\n",
    ),
)
def test_catalog_rejects_function_text_that_is_not_top_level(
    tmp_path: Path,
    valid_release_contract: None,
    script_content: str,
) -> None:
    module_root = tmp_path / "modules"
    _write_manifest(module_root, "apps.manager", required=True)
    _write_manifest(
        module_root,
        "calendar.core",
        function="Invoke-UokCalendar",
        script="modules/calendar.core/verify/UokCandidateCalendar.ps1",
        script_content=script_content,
    )

    with pytest.raises(
        verifier_catalog.CandidateVerifierCatalogError,
        match="script does not define Invoke-UokCalendar",
    ):
        verifier_catalog.candidate_verifier_catalog(module_root)


def test_catalog_rejects_invalid_powershell_syntax(
    tmp_path: Path,
    valid_release_contract: None,
) -> None:
    module_root = tmp_path / "modules"
    _write_manifest(module_root, "apps.manager", required=True)
    _write_manifest(
        module_root,
        "calendar.core",
        function="Invoke-UokCalendar",
        script="modules/calendar.core/verify/UokCandidateCalendar.ps1",
        script_content="function Invoke-UokCalendar {\n",
    )

    with pytest.raises(
        verifier_catalog.CandidateVerifierCatalogError,
        match="PowerShell syntax is invalid",
    ):
        verifier_catalog.candidate_verifier_catalog(module_root)


def test_catalog_rejects_linked_verifier_ownership_root(
    tmp_path: Path,
    valid_release_contract: None,
) -> None:
    module_root = tmp_path / "modules"
    _write_manifest(module_root, "apps.manager", required=True)
    _write_manifest(
        module_root,
        "calendar.core",
        function="Invoke-UokCalendar",
        script="modules/calendar.core/verify/UokCandidateCalendar.ps1",
    )
    verifier_root = module_root / "calendar.core" / "verify"
    external_root = tmp_path / "external-calendar-verifier"
    verifier_root.rename(external_root)
    try:
        verifier_root.symlink_to(external_root, target_is_directory=True)
    except OSError as error:
        pytest.skip(f"directory symlinks are unavailable: {error}")

    with pytest.raises(
        verifier_catalog.CandidateVerifierCatalogError,
        match="ownership path cannot be a link or junction",
    ):
        verifier_catalog.candidate_verifier_catalog(module_root)

from __future__ import annotations

from pathlib import Path

import pytest

import uok.candidate_verifier_catalog as verifier_catalog
import uok.candidate_verifier_preflight as verifier_preflight
from tests.module_manifest_contract_support import write_module


def _candidate_script(tmp_path: Path) -> tuple[Path, Path]:
    module_root = tmp_path / "modules"
    write_module(module_root, "apps.manager", required=True)
    write_module(module_root, "calendar.core", verifier=True)
    return (
        module_root,
        module_root / "calendar.core" / "verify" / "UokCandidateTest.ps1",
    )


def test_catalog_rejects_linked_module_root_before_release_validation(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    physical_root = tmp_path / "modules"
    physical_root.mkdir()
    module_root = tmp_path / "nested" / ".." / "modules"
    checked: list[Path] = []

    def link_check(path: Path) -> bool:
        checked.append(path)
        return path == module_root

    monkeypatch.setattr(verifier_catalog, "_is_link_or_junction", link_check)
    monkeypatch.setattr(
        verifier_catalog,
        "validate_module_release_contracts",
        lambda _root: pytest.fail("release validation must not follow a linked catalog root"),
    )

    with pytest.raises(
        verifier_catalog.CandidateVerifierCatalogError,
        match="module catalog root cannot be a link or junction",
    ):
        verifier_catalog.candidate_verifier_catalog(module_root)

    assert checked == [module_root]


def test_powershell_filter_is_not_accepted_as_verifier_function(tmp_path: Path) -> None:
    script = tmp_path / "filter.ps1"
    script.write_text("filter Invoke-UokCalendar {}\n", encoding="utf-8")

    functions = verifier_catalog._powershell_functions(script, "calendar.core")

    assert "invoke-uokcalendar" not in functions


def test_powershell_workflow_is_not_accepted_as_verifier_function(tmp_path: Path) -> None:
    script = tmp_path / "workflow.ps1"
    script.write_text("workflow Invoke-UokCalendar {}\n", encoding="utf-8")

    try:
        functions = verifier_catalog._powershell_functions(script, "calendar.core")
    except verifier_catalog.CandidateVerifierCatalogError as error:
        assert "PowerShell syntax is invalid" in str(error)
    else:
        assert "invoke-uokcalendar" not in functions


def test_catalog_rejects_duplicate_declared_function_definitions(tmp_path: Path) -> None:
    module_root, script = _candidate_script(tmp_path)
    script.write_text(
        "function Invoke-UokCandidateTest {}\n"
        "function Invoke-UokCandidateTest {}\n",
        encoding="utf-8",
    )

    with pytest.raises(
        verifier_catalog.CandidateVerifierCatalogError,
        match="defines Invoke-UokCandidateTest 2 times",
    ):
        verifier_catalog.candidate_verifier_catalog(module_root)


def test_catalog_rejects_declared_function_redefinition_in_helper(tmp_path: Path) -> None:
    module_root, script = _candidate_script(tmp_path)
    helper = script.with_name("Helper.ps1")
    script.write_text(
        '. (Join-Path $PSScriptRoot "Helper.ps1")\n'
        "function Invoke-UokCandidateTest {}\n",
        encoding="utf-8",
    )
    helper.write_text("function Invoke-UokCandidateTest {}\n", encoding="utf-8")

    with pytest.raises(
        verifier_catalog.CandidateVerifierCatalogError,
        match="defines Invoke-UokCandidateTest 2 times",
    ):
        verifier_catalog.candidate_verifier_catalog(module_root)


def test_catalog_rejects_dynamic_dot_source(tmp_path: Path) -> None:
    module_root, script = _candidate_script(tmp_path)
    script.write_text(
        '$helper = Join-Path $PSScriptRoot "Helper.ps1"\n'
        ". $helper\n"
        "function Invoke-UokCandidateTest {}\n",
        encoding="utf-8",
    )

    with pytest.raises(
        verifier_catalog.CandidateVerifierCatalogError,
        match="dynamic or unsupported dot-source",
    ):
        verifier_catalog.candidate_verifier_catalog(module_root)


@pytest.mark.parametrize(
    ("helper_path", "message"),
    [
        ("./Helper.ps1", "dot-source path is not canonical"),
        ("Missing.ps1", "does not resolve to a PowerShell file"),
    ],
)
def test_catalog_rejects_noncanonical_or_unresolved_dot_source(
    tmp_path: Path,
    helper_path: str,
    message: str,
) -> None:
    module_root, script = _candidate_script(tmp_path)
    script.write_text(
        f'. (Join-Path $PSScriptRoot "{helper_path}")\n'
        "function Invoke-UokCandidateTest {}\n",
        encoding="utf-8",
    )

    with pytest.raises(verifier_catalog.CandidateVerifierCatalogError, match=message):
        verifier_catalog.candidate_verifier_catalog(module_root)


def test_catalog_rejects_dot_source_outside_approved_roots(tmp_path: Path) -> None:
    module_root, script = _candidate_script(tmp_path)
    (tmp_path / "outside.ps1").write_text("function Invoke-Outside {}\n", encoding="utf-8")
    script.write_text(
        '. (Join-Path $PSScriptRoot "../../../outside.ps1")\n'
        "function Invoke-UokCandidateTest {}\n",
        encoding="utf-8",
    )

    with pytest.raises(
        verifier_catalog.CandidateVerifierCatalogError,
        match="outside approved verifier roots",
    ):
        verifier_catalog.candidate_verifier_catalog(module_root)


def test_catalog_rejects_nested_helper_syntax_before_return(tmp_path: Path) -> None:
    module_root, script = _candidate_script(tmp_path)
    helper = script.with_name("Helper.ps1")
    nested = script.with_name("Nested.ps1")
    script.write_text(
        '. (Join-Path $PSScriptRoot "Helper.ps1")\n'
        "function Invoke-UokCandidateTest {}\n",
        encoding="utf-8",
    )
    helper.write_text(
        '. (Join-Path $PSScriptRoot "Nested.ps1")\nfunction Invoke-Helper {}\n',
        encoding="utf-8",
    )
    nested.write_text("function Invoke-Nested {\n", encoding="utf-8")

    with pytest.raises(
        verifier_catalog.CandidateVerifierCatalogError,
        match=r"PowerShell syntax is invalid in Nested\.ps1",
    ):
        verifier_catalog.candidate_verifier_catalog(module_root)


def test_catalog_rejects_linked_dot_source_helper(tmp_path: Path) -> None:
    module_root, script = _candidate_script(tmp_path)
    external = tmp_path / "external-helper.ps1"
    external.write_text("function Invoke-Helper {}\n", encoding="utf-8")
    helper = script.with_name("Helper.ps1")
    try:
        helper.symlink_to(external)
    except OSError as error:
        pytest.skip(f"file symlinks are unavailable: {error}")
    script.write_text(
        '. (Join-Path $PSScriptRoot "Helper.ps1")\n'
        "function Invoke-UokCandidateTest {}\n",
        encoding="utf-8",
    )

    with pytest.raises(
        verifier_catalog.CandidateVerifierCatalogError,
        match="dot-source path cannot be a link or junction",
    ):
        verifier_catalog.candidate_verifier_catalog(module_root)


def test_catalog_rejects_junction_reported_for_dot_source_helper(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module_root, script = _candidate_script(tmp_path)
    helper = script.with_name("Helper.ps1")
    helper.write_text("function Invoke-Helper {}\n", encoding="utf-8")
    script.write_text(
        '. (Join-Path $PSScriptRoot "Helper.ps1")\n'
        "function Invoke-UokCandidateTest {}\n",
        encoding="utf-8",
    )
    real_link_check = verifier_preflight.is_link_or_junction
    monkeypatch.setattr(
        verifier_preflight,
        "is_link_or_junction",
        lambda path: path == helper or real_link_check(path),
    )

    with pytest.raises(
        verifier_catalog.CandidateVerifierCatalogError,
        match="dot-source path cannot be a link or junction",
    ):
        verifier_catalog.candidate_verifier_catalog(module_root)


def test_catalog_parses_approved_shared_helper_once(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module_root = tmp_path / "modules"
    write_module(module_root, "apps.manager", required=True)
    write_module(module_root, "calendar.core", verifier=True)
    write_module(module_root, "reports.core", verifier=True)
    shared = tmp_path / "scripts" / "verify" / "UokCandidateHttp.ps1"
    shared.parent.mkdir(parents=True)
    shared.write_text("function Invoke-UokJson {}\n", encoding="utf-8")
    for module_name, function_name in (
        ("calendar.core", "Invoke-UokCalendar"),
        ("reports.core", "Invoke-UokReports"),
    ):
        manifest = module_root / module_name / "manifest.yaml"
        manifest.write_text(
            manifest.read_text(encoding="utf-8").replace(
                "candidate_verifier_function: Invoke-UokCandidateTest",
                f"candidate_verifier_function: {function_name}",
            ),
            encoding="utf-8",
        )
        script = module_root / module_name / "verify" / "UokCandidateTest.ps1"
        script.write_text(
            '. (Join-Path $PSScriptRoot "../../../scripts/verify/UokCandidateHttp.ps1")\n'
            f"function {function_name} {{}}\n",
            encoding="utf-8",
        )
    real_inspect = verifier_preflight.inspect_powershell_script
    inspections: list[Path] = []

    def inspect_once(path: Path, module_name: str):
        inspections.append(path)
        return real_inspect(path, module_name)

    monkeypatch.setattr(verifier_preflight, "inspect_powershell_script", inspect_once)

    catalog = verifier_catalog.candidate_verifier_catalog(module_root)

    assert [entry["name"] for entry in catalog] == ["calendar.core", "reports.core"]
    assert inspections.count(shared.resolve()) == 1


def test_catalog_rejects_dot_source_cycle(tmp_path: Path) -> None:
    module_root, script = _candidate_script(tmp_path)
    helper = script.with_name("Helper.ps1")
    script.write_text(
        '. (Join-Path $PSScriptRoot "Helper.ps1")\n'
        "function Invoke-UokCandidateTest {}\n",
        encoding="utf-8",
    )
    helper.write_text(
        '. (Join-Path $PSScriptRoot "UokCandidateTest.ps1")\n'
        "function Invoke-Helper {}\n",
        encoding="utf-8",
    )

    with pytest.raises(
        verifier_catalog.CandidateVerifierCatalogError,
        match="dot-source cycle",
    ):
        verifier_catalog.candidate_verifier_catalog(module_root)

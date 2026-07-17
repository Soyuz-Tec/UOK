from __future__ import annotations

import sys
import subprocess
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

import uok.candidate_verifier_catalog as verifier_catalog  # noqa: E402
from scripts.validate_container_module_assets import validate_container_module_assets  # noqa: E402
from tests.module_manifest_contract_support import write_module  # noqa: E402


RUNTIME_PROVEN_MODULES = (
    "apps.manager",
    "calendar.core",
    "communications.core",
    "contacts.core",
    "locations.core",
    "planning.core",
    "product.master",
    "reports.core",
    "routes.core",
    "shipments.core",
)


def test_repository_catalog_and_runtime_assets_are_module_owned() -> None:
    catalog = verifier_catalog.candidate_verifier_catalog()

    assert [entry["name"] for entry in catalog] == list(RUNTIME_PROVEN_MODULES)
    assert all(set(entry) == {"name", "script", "function"} for entry in catalog)
    assert all("/tests/" not in entry["script"] for entry in catalog)
    assert (ROOT / "modules/planning.core/verify/runtime/verify_planning_cpm.py").is_file()


def test_root_candidate_validates_catalog_before_dot_sourcing() -> None:
    source = (ROOT / "scripts/verify_uok_candidate.ps1").read_text(encoding="utf-8")

    assert source.index("candidate_verifier_catalog.py") < source.index("UokCandidateHttp.ps1")
    assert "Get-UokManifestScalars" not in source
    assert "tests/verify" not in source
    assert "$parsedCatalog | ForEach-Object { $_ }" in source
    assert "Candidate verifier catalog entry has invalid field types" in source
    assert "-ChildPath $relativeScript" in source


def test_candidate_disabled_state_proofs_restore_installed_dependents() -> None:
    helper = (ROOT / "scripts/verify/UokCandidateHttp.ps1").read_text(
        encoding="utf-8"
    )
    verifier_paths = (
        "modules/communications.core/verify/UokCandidateCommunications.ps1",
        "modules/contacts.core/verify/UokCandidateContacts.Evidence.ps1",
        "modules/locations.core/verify/UokCandidateLocationMaster.ps1",
        "modules/planning.core/verify/UokCandidatePlanningLinks.ps1",
        "modules/planning.core/verify/UokCandidatePlanningParticipants.ps1",
        "modules/product.master/verify/UokCandidateProductMaster.ps1",
        "modules/routes.core/verify/UokCandidateRouteCorridor.ps1",
        "modules/shipments.core/verify/UokCandidateShipmentSupport.ps1",
    )

    assert "Get-UokDependentUninstallOrder" in helper
    assert '"/api/modules/$dependentName/uninstall"' in helper
    assert "for ($index = $uninstalled.Count - 1;" in helper
    for relative_path in verifier_paths:
        source = (ROOT / relative_path).read_text(encoding="utf-8")
        assert (
            "Invoke-UokWithModuleDisabled" in source
            or "Invoke-UokWithModuleUninstalled" in source
        )
        assert "/disable" not in source
        assert "/enable" not in source
        assert "/uninstall" not in source


def test_container_excludes_tests_and_requires_module_verifiers() -> None:
    dockerignore = (ROOT / ".dockerignore").read_text(encoding="utf-8")
    dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")

    assert "modules/*/tests" in dockerignore
    assert dockerfile.count(
        "python scripts/validate_container_module_assets.py --require-tests-excluded"
    ) == 2
    assert "for module in" not in dockerfile
    assert 'test -d "modules/$module/verify"' not in dockerfile
    assert "COPY modules /app/modules" in dockerfile
    assert "python scripts/generate_frontend_module_catalog.py --check" in dockerfile


def test_container_asset_validator_discovers_repository_verifiers_from_manifests() -> None:
    result = subprocess.run(
        [sys.executable, "scripts/validate_container_module_assets.py"],
        cwd=ROOT,
        capture_output=True,
        check=False,
        text=True,
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "Validated 10 runtime-proven module verifier assets."


def test_ci_builds_the_oci_image_without_publishing() -> None:
    workflow = (ROOT / ".github/workflows/uok-ci.yml").read_text(encoding="utf-8")

    assert "Build OCI image without publishing" in workflow
    assert 'docker build --tag "uok-ci:${GITHUB_SHA}" .' in workflow
    assert "docker push" not in workflow


def test_release_contract_failure_precedes_catalog_discovery(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        verifier_catalog,
        "validate_module_release_contracts",
        lambda _root: {
            "ok": False,
            "violations": [
                {"module": "bad.core", "field": "maturity", "reason": "not releasable"}
            ],
        },
    )

    with pytest.raises(
        verifier_catalog.CandidateVerifierCatalogError,
        match="bad.core:maturity: not releasable",
    ):
        verifier_catalog.candidate_verifier_catalog(tmp_path / "missing-modules")


def test_container_rejects_noncanonical_manifest_test_path(tmp_path: Path) -> None:
    module_root = tmp_path / "modules"
    write_module(
        module_root,
        "apps.manager",
        maturity="runtime_proven",
        required=True,
        verifier=True,
    )
    manifest = module_root / "apps.manager" / "manifest.yaml"
    manifest.write_text(
        manifest.read_text(encoding="utf-8").replace(
            "tests_path: modules/apps.manager/tests",
            "tests_path: modules/apps.manager/qa",
        ),
        encoding="utf-8",
    )
    (module_root / "apps.manager" / "tests").rename(
        module_root / "apps.manager" / "qa"
    )

    with pytest.raises(
        ValueError,
        match=r"tests_path must be exactly modules/<module_name>/tests",
    ):
        validate_container_module_assets(
            module_root,
            require_tests_excluded=True,
        )


def test_container_rejects_tests_and_durable_javascript_under_web_path(
    tmp_path: Path,
) -> None:
    module_root = tmp_path / "modules"
    write_module(
        module_root,
        "apps.manager",
        required=True,
        web_surface="apps",
    )
    web_source = module_root / "apps.manager" / "web" / "src"
    (web_source / "legacy.js").write_text("export {};\n", encoding="utf-8")
    (web_source / "legacy.mjs").write_text("export {};\n", encoding="utf-8")
    (web_source / "Widget.test.tsx").write_text("export {};\n", encoding="utf-8")

    with pytest.raises(ValueError) as error:
        validate_container_module_assets(module_root, require_tests_excluded=False)

    message = str(error.value)
    assert "durable JavaScript is not allowed: src/legacy.js" in message
    assert "durable JavaScript is not allowed: src/legacy.mjs" in message
    assert "frontend tests must live under tests_path: src/Widget.test.tsx" in message


def test_container_rejects_noncanonical_nested_test_directories(tmp_path: Path) -> None:
    module_root = tmp_path / "modules"
    write_module(
        module_root,
        "apps.manager",
        required=True,
        web_surface="apps",
        release_assets=False,
    )
    leaked = module_root / "apps.manager" / "backend" / "tests"
    leaked.mkdir()
    (leaked / "test_leak.py").write_text("assert True\n", encoding="utf-8")

    with pytest.raises(ValueError) as error:
        validate_container_module_assets(module_root, require_tests_excluded=True)

    message = str(error.value)
    assert "modules/apps.manager/backend/tests" in message
    assert "modules/apps.manager/backend/tests/test_leak.py" in message

from __future__ import annotations

from pathlib import Path

import pytest

from tests.module_manifest_contract_support import manifest_text, write_module
from uok.module_contract_validation import (
    validate_module_release_contracts,
    validate_module_runtime_contracts,
)
from uok.module_manifest_loader import load_module_manifest, load_module_manifests
from uok.module_manifest_schema import EXTENSION_REGISTRY, MATURITY_LEVELS


def _load_text(tmp_path: Path, text: str) -> dict[str, object]:
    path = tmp_path / "manifest.yaml"
    path.write_text(text, encoding="utf-8")
    return load_module_manifest(path)


def _replace_lifecycle(path: Path, states: tuple[str, ...]) -> None:
    text = path.read_text(encoding="utf-8")
    start = text.index("lifecycle:")
    end = text.index("commands:", start)
    value = "lifecycle: []\n" if not states else "lifecycle:\n" + "".join(
        f"  - {state}\n" for state in states
    )
    path.write_text(text[:start] + value + text[end:], encoding="utf-8")


@pytest.mark.parametrize(
    ("mutation", "message"),
    [
        (lambda text: text + "name: duplicate.core\n", "repeats manifest key name"),
        (lambda text: text + "unknown_field: value\n", "unknown fields: unknown_field"),
        (lambda text: text.replace("installable: false", 'installable: "false"'), "installable must be a boolean"),
        (lambda text: text.replace("commands: []", "commands: CreateThing"), "commands must be a list"),
        (lambda text: text.replace("commands: []", "commands:\n  - Same\n  - Same"), "commands contains duplicate values"),
    ],
)
def test_manifest_parser_rejects_ambiguous_or_unknown_shapes(
    tmp_path: Path, mutation, message: str
) -> None:
    with pytest.raises(ValueError, match=message):
        _load_text(tmp_path, mutation(manifest_text("alpha.core", maturity="planned")))


@pytest.mark.parametrize("field", ["manifest_schema", "maturity", "name"])
def test_manifest_parser_rejects_wrong_scalar_types(tmp_path: Path, field: str) -> None:
    text = manifest_text("alpha.core", maturity="planned")
    value = {"manifest_schema": "uok.module.v1", "maturity": "planned", "name": "alpha.core"}[field]
    text = text.replace(f"{field}: {value}", f"{field}:\n  - {value}")
    with pytest.raises(ValueError, match=f"{field} must be a non-empty string"):
        _load_text(tmp_path, text)


def test_manifest_parser_preserves_hash_inside_quoted_value(tmp_path: Path) -> None:
    text = manifest_text("alpha.core", maturity="planned").replace(
        'description: "Test module"',
        'description: "Phase #1 module" # release note',
    )

    manifest = _load_text(tmp_path, text)

    assert manifest["description"] == "Phase #1 module"


def test_manifest_parser_rejects_unbalanced_quoted_value(tmp_path: Path) -> None:
    text = manifest_text("alpha.core", maturity="planned").replace(
        'description: "Test module"',
        'description: "Phase #1 module',
    )

    with pytest.raises(ValueError, match="unbalanced quoted manifest value"):
        _load_text(tmp_path, text)


def test_manifest_parser_enforces_schema_maturity_and_closed_extensions(tmp_path: Path) -> None:
    valid = manifest_text("alpha.core", maturity="planned")
    with pytest.raises(ValueError, match="manifest_schema must be uok.module.v1"):
        _load_text(tmp_path, valid.replace("uok.module.v1", "uok.module.v2"))
    with pytest.raises(ValueError, match="maturity must be one of"):
        _load_text(tmp_path, valid.replace("maturity: planned", "maturity: production_ready"))
    with pytest.raises(ValueError, match="unknown extension points"):
        _load_text(tmp_path, valid.replace("extension_points: []", "extension_points:\n  - invented_hook"))
    with pytest.raises(ValueError, match="extension api_router requires fields"):
        _load_text(tmp_path, valid.replace("extension_points: []", "extension_points:\n  - api_router"))
    with pytest.raises(ValueError, match="fields api_router require extension api_router"):
        _load_text(tmp_path, valid.replace("permissions: []", "api_router: alpha_core.api:router\npermissions: []"))


def test_repository_manifests_use_exact_maturity_and_extension_taxonomies() -> None:
    manifests = load_module_manifests()
    assert set(MATURITY_LEVELS) == {
        "planned", "source_present", "unit_tested", "integration_tested", "runtime_proven"
    }
    assert set(EXTENSION_REGISTRY) == {
        "api_router", "command_handlers", "command_permissions", "command_replay_guard",
        "role_grants", "dashboard_provider", "evidence_provider", "model_exports", "candidate_verifier",
    }
    assert manifests["agents.core"]["maturity"] == "planned"
    assert manifests["agents.core"]["extension_points"] == []
    assert all(manifest["manifest_schema"] == "uok.module.v1" for manifest in manifests.values())


def test_repository_runtime_and_release_contracts_are_valid() -> None:
    runtime = validate_module_runtime_contracts()
    release = validate_module_release_contracts()
    assert runtime["ok"] is True, runtime["violations"]
    assert release["ok"] is True, release["violations"]


def test_runtime_contract_ignores_release_asset_existence(tmp_path: Path) -> None:
    module_root = tmp_path / "modules"
    write_module(module_root, "apps.manager", required=True, release_assets=False)
    write_module(module_root, "agents.core", maturity="planned", release_assets=False)
    write_module(
        module_root, "proof.core", maturity="runtime_proven", verifier=True, release_assets=False
    )

    assert validate_module_runtime_contracts(module_root)["ok"] is True
    release = validate_module_release_contracts(module_root)
    assert release["ok"] is False
    fields = {row["field"] for row in release["violations"]}
    assert {"tests_path", "candidate_verifier_script"}.issubset(fields)


def test_catalog_rejects_dependency_failures_and_backend_package_collisions(tmp_path: Path) -> None:
    module_root = tmp_path / "modules"
    write_module(module_root, "apps.manager", required=True)
    write_module(module_root, "alpha.core", dependencies=("beta.core",), package="shared_backend")
    write_module(module_root, "beta.core", dependencies=("alpha.core",), package="shared_backend")
    write_module(module_root, "gamma.core", dependencies=("gamma.core", "missing.core"))

    report = validate_module_runtime_contracts(module_root)
    reasons = "\n".join(row["reason"] for row in report["violations"])
    assert report["ok"] is False
    assert "dependency cycle" in reasons
    assert "cannot depend on itself" in reasons
    assert "unknown module dependency: missing.core" in reasons
    assert "backend package shared_backend is already owned by alpha.core" in reasons


def test_runtime_contract_rejects_missing_import_target_attribute(tmp_path: Path) -> None:
    module_root = tmp_path / "modules"
    write_module(module_root, "apps.manager", required=True)
    write_module(module_root, "alpha.core", package="alpha_backend", exported_attribute="not_router")

    report = validate_module_runtime_contracts(module_root)
    assert any(
        row["field"] == "api_router" and "target alpha_backend.api:router was not found" in row["reason"]
        for row in report["violations"]
    )


def test_runtime_contract_requires_declared_default_for_optional_module(tmp_path: Path) -> None:
    module_root = tmp_path / "modules"
    write_module(module_root, "apps.manager", required=True)
    write_module(module_root, "alpha.core")
    manifest_path = module_root / "alpha.core" / "manifest.yaml"
    text = manifest_path.read_text(encoding="utf-8")
    text = text.replace("installable: true\n", "installable: false\n", 1)
    text = text.replace("  - available\n", "", 1)
    manifest_path.write_text(text, encoding="utf-8")

    report = validate_module_runtime_contracts(module_root)

    assert any(
        row["field"] == "lifecycle"
        and "optional_modules_default_ready" in row["reason"]
        for row in report["violations"]
    )


@pytest.mark.parametrize(
    ("module_name", "states", "expected_check"),
    [
        (
            "alpha.core",
            ("available", "disabled", "upgraded", "uninstalled"),
            "installable_modules_lifecycle_ready",
        ),
        (
            "alpha.core",
            ("available", "installed", "disabled", "upgraded"),
            "uninstallable_modules_lifecycle_ready",
        ),
        (
            "alpha.core",
            ("available", "installed", "disabled", "uninstalled"),
            "updatable_modules_lifecycle_ready",
        ),
        ("apps.manager", ("upgraded",), "required_modules_bootstrap_ready"),
        ("alpha.core", (), "lifecycle_states_valid"),
    ],
)
def test_runtime_contract_enforces_lifecycle_policy_checks(
    tmp_path: Path,
    module_name: str,
    states: tuple[str, ...],
    expected_check: str,
) -> None:
    module_root = tmp_path / "modules"
    write_module(module_root, "apps.manager", required=True)
    write_module(module_root, "alpha.core")
    _replace_lifecycle(module_root / module_name / "manifest.yaml", states)

    report = validate_module_runtime_contracts(module_root)

    assert report["ok"] is False
    assert any(
        row["reason"] == f"lifecycle policy check failed: {expected_check}"
        for row in report["violations"]
    )


def test_runtime_contract_rejects_required_module_with_uninstallable_flag(
    tmp_path: Path,
) -> None:
    module_root = tmp_path / "modules"
    write_module(module_root, "apps.manager", required=True)
    manifest = module_root / "apps.manager" / "manifest.yaml"
    manifest.write_text(
        manifest.read_text(encoding="utf-8").replace(
            "uninstallable: false", "uninstallable: true"
        ),
        encoding="utf-8",
    )

    report = validate_module_runtime_contracts(module_root)

    assert any(
        row["reason"] == "lifecycle policy check failed: required_modules_protected"
        for row in report["violations"]
    )


def test_importing_dotted_module_does_not_bind_final_name(tmp_path: Path) -> None:
    module_root = tmp_path / "modules"
    write_module(module_root, "apps.manager", required=True)
    write_module(
        module_root,
        "alpha.core",
        package="alpha_backend",
        exported_attribute="not_router",
    )
    package = module_root / "alpha.core" / "backend" / "alpha_backend"
    (package / "router.py").write_text("router = object()\n", encoding="utf-8")
    (package / "api.py").write_text("import alpha_backend.router\n", encoding="utf-8")

    report = validate_module_runtime_contracts(module_root)

    assert any(
        row["field"] == "api_router"
        and "target alpha_backend.api:router was not found" in row["reason"]
        for row in report["violations"]
    )

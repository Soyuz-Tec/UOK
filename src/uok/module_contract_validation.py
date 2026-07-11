from __future__ import annotations

from pathlib import Path
from typing import Any

from .module_contract_rules import (
    PATH_FIELDS,
    validate_catalog_relationships,
    validate_manifest_semantics,
    violation,
)
from .module_lifecycle_policy import lifecycle_policy_checks
from .module_manifest_loader import load_module_manifests
from .module_paths import modules_root


_LIFECYCLE_POLICY_FIELDS = {
    "lifecycle_flags_boolean": "lifecycle",
    "maturity_values_valid": "maturity",
    "lifecycle_states_valid": "lifecycle",
    "required_modules_bootstrap_ready": "lifecycle",
    "required_modules_protected": "lifecycle",
    "installable_modules_lifecycle_ready": "lifecycle",
    "uninstallable_modules_lifecycle_ready": "lifecycle",
    "updatable_modules_lifecycle_ready": "lifecycle",
    "planned_modules_inert": "maturity",
    "optional_modules_default_ready": "lifecycle",
    "dependencies_declared": "dependencies",
}


def validate_module_runtime_contracts(root: Path | None = None) -> dict[str, Any]:
    """Validate contracts required to compose and operate the application runtime."""

    return _validate_module_contracts("runtime", root)


def validate_module_release_contracts(root: Path | None = None) -> dict[str, Any]:
    """Validate runtime contracts plus source-owned tests and release verifiers."""

    return _validate_module_contracts("release", root)


def validate_module_extension_contracts(root: Path | None = None) -> dict[str, Any]:
    """Compatibility name for the runtime-safe module contract report."""

    return validate_module_runtime_contracts(root)


def _validate_module_contracts(scope: str, root: Path | None) -> dict[str, Any]:
    if scope not in {"runtime", "release"}:
        raise ValueError("module contract scope must be runtime or release")
    module_root = (root or modules_root()).resolve()
    manifests = load_module_manifests(module_root)
    violations: list[dict[str, str]] = []
    for module_name, manifest in manifests.items():
        validate_manifest_semantics(module_name, manifest, module_root, scope, violations)
        _validate_lifecycle_policy(module_name, manifest, manifests, violations)

    command_owners, event_owners = validate_catalog_relationships(
        manifests, module_root, violations
    )
    required_modules = sorted(
        name for name, manifest in manifests.items() if manifest["required"]
    )
    if required_modules != ["apps.manager"]:
        violation(
            violations,
            "catalog",
            "required",
            "only apps.manager may be required in the baseline catalog",
        )
    _validate_verifier_function_ownership(manifests, violations)
    return _report(
        scope,
        len(manifests),
        required_modules,
        command_owners,
        event_owners,
        violations,
    )


def _validate_verifier_function_ownership(
    manifests: dict[str, dict[str, Any]], violations: list[dict[str, str]]
) -> None:
    owners: dict[str, str] = {}
    for module_name, manifest in manifests.items():
        function_name = manifest.get("candidate_verifier_function")
        if function_name is None:
            continue
        normalized = str(function_name).casefold()
        if normalized in owners:
            violation(
                violations,
                module_name,
                "candidate_verifier_function",
                f"candidate verifier function is already owned by {owners[normalized]}",
            )
        owners[normalized] = module_name


def _report(
    scope: str,
    module_count: int,
    required_modules: list[str],
    command_owners: dict[str, str],
    event_owners: dict[str, str],
    violations: list[dict[str, str]],
) -> dict[str, Any]:
    def fields_are_valid(*fields: str) -> bool:
        return not any(row["field"] in fields for row in violations)

    return {
        "ok": not violations,
        "scope": scope,
        "checks": {
            "module_count": module_count,
            "required_modules": required_modules,
            "command_owner_count": len(command_owners),
            "event_owner_count": len(event_owners),
            "manifest_schema_valid": True,
            "extensions_closed": True,
            "all_paths_module_scoped": fields_are_valid(*PATH_FIELDS),
            "commands_unique": fields_are_valid("commands"),
            "events_unique": fields_are_valid("events"),
            "api_routers_valid": fields_are_valid("api_router", "api_prefixes"),
            "command_handlers_valid": fields_are_valid("command_handlers", "command_permissions"),
            "command_replay_guards_valid": fields_are_valid("command_replay_guard"),
            "role_grants_valid": fields_are_valid("role_grants"),
            "dashboard_providers_valid": fields_are_valid("dashboard_provider"),
            "evidence_providers_valid": fields_are_valid("evidence_provider"),
            "model_exports_valid": fields_are_valid("model_exports"),
            "candidate_verifiers_valid": fields_are_valid(
                "candidate_verifier_script", "candidate_verifier_function"
            ),
            "owned_table_claims_valid": fields_are_valid("owned_tables"),
            "manifest_maturity_valid": fields_are_valid("maturity", "lifecycle"),
            "dependencies_valid": fields_are_valid("dependencies"),
            "backend_packages_unique": fields_are_valid("backend_path"),
            "release_assets_valid": scope != "release"
            or fields_are_valid("tests_path", "candidate_verifier_script", "maturity"),
        },
        "violations": violations,
    }


def _validate_lifecycle_policy(
    module_name: str,
    manifest: dict[str, Any],
    manifests: dict[str, dict[str, Any]],
    violations: list[dict[str, str]],
) -> None:
    checks = lifecycle_policy_checks(module_name, manifest, manifests)
    for check_name, field in _LIFECYCLE_POLICY_FIELDS.items():
        if checks[check_name] is not True:
            violation(
                violations,
                module_name,
                field,
                f"lifecycle policy check failed: {check_name}",
            )

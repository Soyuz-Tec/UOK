from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from .module_imports import IMPORT_TARGET_SPEC_PATTERN, module_import_backend_package_exists
from .module_manifest_loader import load_module_manifests
from .module_paths import modules_root, repo_root
from .module_tables import undeclared_owned_table_models

ALLOWED_MODULE_KINDS = {"control_module", "capability_module", "business_module"}
PATH_FIELDS = ("backend_path", "web_path", "migrations_path", "tests_path")
LIST_FIELDS = ("lifecycle", "commands", "events", "dependencies", "api_prefixes", "permissions", "owned_tables", "extension_points")
MODULE_NAME_PATTERN = re.compile(r"^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$")
API_ROUTER_SPEC_PATTERN = IMPORT_TARGET_SPEC_PATTERN
POWERSHELL_FUNCTION_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z][A-Za-z0-9]*)*$")
PYTHON_EXTENSION_FIELDS = {
    "command_handlers": "command_handlers",
    "command_permissions": "permissions",
    "command_replay_guard": "command_replay_guard",
    "role_grants": "permissions",
    "dashboard_provider": "dashboard_provider",
    "evidence_provider": "evidence_provider",
    "model_exports": "model_exports",
}


def validate_module_extension_contracts() -> dict[str, Any]:
    root = modules_root()
    manifests = load_module_manifests(root)
    violations: list[dict[str, str]] = []
    command_owners: dict[str, str] = {}
    event_owners: dict[str, str] = {}

    for module_name, manifest in manifests.items():
        _validate_manifest_identity(module_name, manifest, violations)
        _validate_manifest_paths(module_name, manifest, violations)
        _validate_manifest_lists(module_name, manifest, violations)
        _validate_api_prefixes(module_name, manifest, violations)
        _validate_api_router(module_name, manifest, violations)
        _validate_python_extensions(module_name, manifest, violations)
        _validate_candidate_verifier(module_name, manifest, violations)
        _collect_unique_owners(module_name, manifest, "commands", command_owners, violations)
        _collect_unique_owners(module_name, manifest, "events", event_owners, violations)

    _validate_owned_table_models(violations)
    required_modules = sorted(name for name, manifest in manifests.items() if manifest.get("required") is True)
    if required_modules != ["apps.manager"]:
        violations.append({
            "module": "catalog",
            "field": "required",
            "reason": "only apps.manager may be required in the baseline catalog",
        })

    return {
        "ok": not violations,
        "checks": {
            "module_count": len(manifests),
            "required_modules": required_modules,
            "command_owner_count": len(command_owners),
            "event_owner_count": len(event_owners),
            "all_paths_module_scoped": not any(v["field"] in PATH_FIELDS for v in violations),
            "commands_unique": not any(v["field"] == "commands" for v in violations),
            "events_unique": not any(v["field"] == "events" for v in violations),
            "api_routers_valid": not any(v["field"] == "api_router" for v in violations),
            "command_handlers_valid": not any(v["field"] in {"command_handlers", "command_permissions"} for v in violations),
            "command_replay_guards_valid": not any(v["field"] == "command_replay_guard" for v in violations),
            "role_grants_valid": not any(v["field"] == "role_grants" for v in violations),
            "dashboard_providers_valid": not any(v["field"] == "dashboard_provider" for v in violations),
            "evidence_providers_valid": not any(v["field"] == "evidence_provider" for v in violations),
            "model_exports_valid": not any(v["field"] == "model_exports" for v in violations),
            "candidate_verifiers_valid": not any(v["field"].startswith("candidate_") for v in violations),
            "owned_tables_resolve_to_models": not any(v["field"] == "owned_tables" for v in violations),
        },
        "violations": violations,
    }


def _validate_manifest_identity(module_name: str, manifest: dict[str, Any], violations: list[dict[str, str]]) -> None:
    if not MODULE_NAME_PATTERN.fullmatch(module_name):
        violations.append({"module": module_name, "field": "name", "reason": "module name must be lowercase dotted form"})
    if manifest.get("name") != module_name:
        violations.append({"module": module_name, "field": "name", "reason": "manifest name must match folder name"})
    if manifest.get("kind") not in ALLOWED_MODULE_KINDS:
        violations.append({"module": module_name, "field": "kind", "reason": "module kind is not allowed"})
    if not str(manifest.get("data_retention_policy", "")).strip():
        violations.append({"module": module_name, "field": "data_retention_policy", "reason": "data retention policy is required"})


def _validate_manifest_paths(module_name: str, manifest: dict[str, Any], violations: list[dict[str, str]]) -> None:
    workspace = repo_root()
    for field in PATH_FIELDS:
        raw_value = str(manifest.get(field, "")).strip()
        path = Path(raw_value)
        if not raw_value or path.is_absolute() or ".." in path.parts:
            violations.append({"module": module_name, "field": field, "reason": "path must be a safe relative module path"})
            continue
        if len(path.parts) < 3 or path.parts[0] != "modules" or path.parts[1] != module_name:
            violations.append({"module": module_name, "field": field, "reason": "path must stay under modules/<module_name>"})
            continue
        if not (workspace / path).is_dir():
            violations.append({"module": module_name, "field": field, "reason": "declared path does not exist"})


def _validate_manifest_lists(module_name: str, manifest: dict[str, Any], violations: list[dict[str, str]]) -> None:
    for field in LIST_FIELDS:
        if not isinstance(manifest.get(field), list):
            violations.append({"module": module_name, "field": field, "reason": "field must be a list"})


def _validate_api_prefixes(module_name: str, manifest: dict[str, Any], violations: list[dict[str, str]]) -> None:
    for prefix in manifest.get("api_prefixes", []):
        if not isinstance(prefix, str) or not prefix.startswith("/api/"):
            violations.append({"module": module_name, "field": "api_prefixes", "reason": "API prefixes must start with /api/"})


def _validate_api_router(module_name: str, manifest: dict[str, Any], violations: list[dict[str, str]]) -> None:
    spec = manifest.get("api_router")
    if spec is None:
        return
    if not isinstance(spec, str) or not API_ROUTER_SPEC_PATTERN.fullmatch(spec):
        violations.append({"module": module_name, "field": "api_router", "reason": "api_router must use <package.module>:<attribute>"})
        return
    if "api_router" not in manifest.get("extension_points", []):
        violations.append({"module": module_name, "field": "api_router", "reason": "api_router requires the api_router extension point"})
    if not manifest.get("api_prefixes"):
        violations.append({"module": module_name, "field": "api_router", "reason": "api_router requires declared api_prefixes"})
    backend_package = spec.partition(":")[0].split(".")[0]
    backend_path = Path(str(manifest.get("backend_path", "")))
    if not (repo_root() / backend_path / backend_package / "__init__.py").is_file():
        violations.append({"module": module_name, "field": "api_router", "reason": "api_router must resolve from the module backend package"})


def _validate_python_extensions(module_name: str, manifest: dict[str, Any], violations: list[dict[str, str]]) -> None:
    for field, extension_point in PYTHON_EXTENSION_FIELDS.items():
        spec = manifest.get(field)
        if spec is None:
            continue
        if not isinstance(spec, str) or not IMPORT_TARGET_SPEC_PATTERN.fullmatch(spec):
            violations.append({"module": module_name, "field": field, "reason": f"{field} must use <package.module>:<attribute>"})
            continue
        if extension_point not in manifest.get("extension_points", []):
            violations.append({"module": module_name, "field": field, "reason": f"{field} requires the {extension_point} extension point"})
        if not module_import_backend_package_exists(manifest, spec):
            violations.append({"module": module_name, "field": field, "reason": f"{field} must resolve from the module backend package"})
        if field == "command_handlers" and not manifest.get("commands"):
            violations.append({"module": module_name, "field": field, "reason": "command_handlers requires declared commands"})
        if field == "command_permissions" and not manifest.get("permissions"):
            violations.append({"module": module_name, "field": field, "reason": "command_permissions requires declared permissions"})


def _validate_candidate_verifier(module_name: str, manifest: dict[str, Any], violations: list[dict[str, str]]) -> None:
    script = manifest.get("candidate_verifier_script")
    function_name = manifest.get("candidate_verifier_function")
    evidence_function = manifest.get("candidate_evidence_function")
    if script is None and function_name is None and evidence_function is None:
        return
    if "candidate_verifier" not in manifest.get("extension_points", []):
        violations.append({"module": module_name, "field": "candidate_verifier", "reason": "candidate verifier fields require the candidate_verifier extension point"})
    if not isinstance(script, str) or not script.strip():
        violations.append({"module": module_name, "field": "candidate_verifier_script", "reason": "candidate_verifier_script is required"})
    else:
        path = Path(script)
        if path.is_absolute() or ".." in path.parts:
            violations.append({"module": module_name, "field": "candidate_verifier_script", "reason": "candidate verifier script must be a safe relative path"})
        elif len(path.parts) < 3 or path.parts[0] != "modules" or path.parts[1] != module_name:
            violations.append({"module": module_name, "field": "candidate_verifier_script", "reason": "candidate verifier script must stay under modules/<module_name>"})
        elif not (repo_root() / path).is_file():
            violations.append({"module": module_name, "field": "candidate_verifier_script", "reason": "candidate verifier script does not exist"})
    if not isinstance(function_name, str) or not POWERSHELL_FUNCTION_PATTERN.fullmatch(function_name):
        violations.append({"module": module_name, "field": "candidate_verifier_function", "reason": "candidate_verifier_function must be a PowerShell function name"})
    if evidence_function is not None and (not isinstance(evidence_function, str) or not POWERSHELL_FUNCTION_PATTERN.fullmatch(evidence_function)):
        violations.append({"module": module_name, "field": "candidate_evidence_function", "reason": "candidate_evidence_function must be a PowerShell function name"})


def _validate_owned_table_models(violations: list[dict[str, str]]) -> None:
    for module_name, missing_models in undeclared_owned_table_models().items():
        violations.append({
            "module": module_name,
            "field": "owned_tables",
            "reason": f"owned table model declarations do not resolve: {', '.join(sorted(missing_models))}",
        })


def _collect_unique_owners(
    module_name: str,
    manifest: dict[str, Any],
    field: str,
    owners: dict[str, str],
    violations: list[dict[str, str]],
) -> None:
    for item in manifest.get(field, []):
        if item in owners:
            violations.append({
                "module": module_name,
                "field": field,
                "reason": f"{item} is already owned by {owners[item]}",
            })
        owners[item] = module_name

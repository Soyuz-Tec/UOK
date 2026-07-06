from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from .module_manifest_loader import load_module_manifests
from .module_paths import modules_root, repo_root

ALLOWED_MODULE_KINDS = {"control_module", "capability_module", "business_module"}
PATH_FIELDS = ("backend_path", "web_path", "migrations_path", "tests_path")
LIST_FIELDS = ("lifecycle", "commands", "events", "dependencies", "api_prefixes", "permissions", "owned_tables", "extension_points")
MODULE_NAME_PATTERN = re.compile(r"^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$")


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
        _collect_unique_owners(module_name, manifest, "commands", command_owners, violations)
        _collect_unique_owners(module_name, manifest, "events", event_owners, violations)

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

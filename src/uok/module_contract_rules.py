from __future__ import annotations

import ast
import re
from pathlib import Path
from typing import Any

from .module_api_prefixes import validate_api_prefix_ownership, validate_api_prefixes
from .host.module_imports import IMPORT_TARGET_SPEC_PATTERN
from .module_manifest_schema import IMPORT_TARGET_FIELDS
from .module_model_claims import validate_owned_table_claims
from .module_web_contract import validate_web_section_ownership, validate_web_surface
ALLOWED_MODULE_KINDS = {"control_module", "capability_module", "business_module"}
PATH_FIELDS = ("backend_path", "web_path", "migrations_path", "tests_path")
RUNTIME_PATH_FIELDS = {"backend_path", "migrations_path"}
MODULE_NAME_PATTERN = re.compile(r"^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$")
POWERSHELL_FUNCTION_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z][A-Za-z0-9]*)*$")
ALLOWED_LIFECYCLE_STATES = {
    "planned",
    "available",
    "installed",
    "disabled",
    "upgraded",
    "uninstalled",
}
TESTED_MATURITY = {"unit_tested", "integration_tested", "runtime_proven"}


def violation(rows: list[dict[str, str]], module: str, field: str, reason: str) -> None:
    rows.append({"module": module, "field": field, "reason": reason})


def validate_manifest_semantics(
    module_name: str,
    manifest: dict[str, Any],
    module_root: Path,
    scope: str,
    rows: list[dict[str, str]],
) -> None:
    if not MODULE_NAME_PATTERN.fullmatch(module_name):
        violation(rows, module_name, "name", "module name must be lowercase dotted form")
    if manifest["kind"] not in ALLOWED_MODULE_KINDS:
        violation(rows, module_name, "kind", "module kind is not allowed")
    unknown_states = sorted(set(manifest["lifecycle"]) - ALLOWED_LIFECYCLE_STATES)
    if unknown_states:
        violation(rows, module_name, "lifecycle", f"unknown lifecycle states: {', '.join(unknown_states)}")
    _validate_planned_module(module_name, manifest, rows)
    _validate_paths(module_name, manifest, module_root, scope, rows)
    validate_web_surface(
        module_name,
        manifest,
        module_root,
        rows,
        require_entry_asset=scope in {"frontend", "release"},
    )
    validate_api_prefixes(module_name, manifest["api_prefixes"], rows)
    _validate_import_targets(module_name, manifest, module_root, rows)
    _validate_candidate_verifier(module_name, manifest, module_root, scope, rows)
    if scope == "release" and manifest["maturity"] in TESTED_MATURITY:
        tests_path = module_root.parent / Path(manifest["tests_path"])
        has_tests = tests_path.is_dir() and any(
            path.is_file() and (path.name.startswith("test_") or path.name.endswith("_test.py"))
            for path in tests_path.rglob("*.py")
        )
        if not has_tests:
            violation(rows, module_name, "maturity", f"{manifest['maturity']} requires module-owned tests")


def _validate_planned_module(
    module_name: str, manifest: dict[str, Any], rows: list[dict[str, str]]
) -> None:
    if manifest["maturity"] == "runtime_proven" and "candidate_verifier" not in manifest["extension_points"]:
        violation(rows, module_name, "maturity", "runtime_proven requires a candidate_verifier")
    if manifest["maturity"] != "planned":
        return
    enabled_flags = [
        field
        for field in ("installable", "uninstallable", "updatable", "maintainable", "required")
        if manifest[field]
    ]
    if enabled_flags:
        violation(rows, module_name, "maturity", f"planned module enables flags: {', '.join(enabled_flags)}")
    if manifest["lifecycle"] != ["planned"]:
        violation(rows, module_name, "lifecycle", "planned module lifecycle must be exactly planned")
    active_fields = [
        field
        for field in ("commands", "events", "api_prefixes", "permissions", "owned_tables", "extension_points")
        if manifest[field]
    ]
    if active_fields:
        violation(rows, module_name, "maturity", f"planned module declares active capabilities: {', '.join(active_fields)}")


def _validate_paths(
    module_name: str,
    manifest: dict[str, Any],
    module_root: Path,
    scope: str,
    rows: list[dict[str, str]],
) -> None:
    workspace = module_root.parent
    required_paths = (
        set(PATH_FIELDS)
        if scope == "release"
        else RUNTIME_PATH_FIELDS | ({"web_path"} if scope == "frontend" else set())
    )
    for field in PATH_FIELDS:
        raw_value = manifest[field].strip()
        path = Path(raw_value)
        if path.is_absolute() or ".." in path.parts:
            violation(rows, module_name, field, "path must be a safe relative module path")
            continue
        if len(path.parts) < 3 or path.parts[0] != "modules" or path.parts[1] != module_name:
            violation(rows, module_name, field, "path must stay under modules/<module_name>")
            continue
        if field == "tests_path" and path.parts != ("modules", module_name, "tests"):
            violation(
                rows,
                module_name,
                field,
                "tests_path must be exactly modules/<module_name>/tests",
            )
            continue
        if field in required_paths and not (workspace / path).is_dir():
            violation(rows, module_name, field, f"declared {scope} path does not exist")


def _validate_import_targets(
    module_name: str,
    manifest: dict[str, Any],
    module_root: Path,
    rows: list[dict[str, str]],
) -> None:
    backend = module_root.parent / Path(manifest["backend_path"])
    for field in sorted(IMPORT_TARGET_FIELDS):
        spec = manifest.get(field)
        if spec is None:
            continue
        if not IMPORT_TARGET_SPEC_PATTERN.fullmatch(spec):
            violation(rows, module_name, field, f"{field} must use <package.module>:<attribute>")
            continue
        package = spec.partition(":")[0].split(".")[0]
        if not (backend / package / "__init__.py").is_file():
            violation(rows, module_name, field, f"{field} must resolve from the module backend package")
        elif not _import_target_attribute_exists(backend, spec):
            violation(rows, module_name, field, f"{field} target {spec} was not found in module source")
    if manifest.get("api_router") is not None and not manifest["api_prefixes"]:
        violation(rows, module_name, "api_router", "api_router requires declared api_prefixes")
    if manifest.get("command_handlers") is not None and not manifest["commands"]:
        violation(rows, module_name, "command_handlers", "command_handlers requires declared commands")
    if manifest.get("command_permissions") is not None:
        if not manifest["commands"]:
            violation(rows, module_name, "command_permissions", "command_permissions requires declared commands")
        if not manifest["permissions"]:
            violation(rows, module_name, "command_permissions", "command_permissions requires declared permissions")
    if manifest.get("role_grants") is not None and not manifest["permissions"]:
        violation(rows, module_name, "role_grants", "role_grants requires declared permissions")


def _import_target_attribute_exists(backend: Path, spec: str) -> bool:
    module_name, _, attribute = spec.partition(":")
    module_parts = module_name.split(".")
    file_path = backend.joinpath(*module_parts).with_suffix(".py")
    if not file_path.is_file():
        file_path = backend.joinpath(*module_parts, "__init__.py")
    if not file_path.is_file():
        return False
    try:
        tree = ast.parse(file_path.read_text(encoding="utf-8"))
    except (OSError, SyntaxError, UnicodeError):
        return False
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            if node.name == attribute:
                return True
        elif isinstance(node, ast.Import):
            if any((alias.asname or alias.name.split(".")[0]) == attribute for alias in node.names):
                return True
        elif isinstance(node, ast.ImportFrom):
            if any((alias.asname or alias.name) == attribute for alias in node.names):
                return True
        elif isinstance(node, (ast.Assign, ast.AnnAssign)):
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            if any(isinstance(target, ast.Name) and target.id == attribute for target in targets):
                return True
    return False


def _validate_candidate_verifier(
    module_name: str,
    manifest: dict[str, Any],
    module_root: Path,
    scope: str,
    rows: list[dict[str, str]],
) -> None:
    script = manifest.get("candidate_verifier_script")
    function_name = manifest.get("candidate_verifier_function")
    if script is None:
        return
    path = Path(script)
    if (
        path.is_absolute()
        or ".." in path.parts
        or len(path.parts) < 4
        or path.parts[:3] != ("modules", module_name, "verify")
        or path.suffix.casefold() != ".ps1"
    ):
        violation(rows, module_name, "candidate_verifier_script", "candidate verifier must be a PowerShell path under modules/<module_name>/verify")
    elif scope == "release" and not (module_root.parent / path).is_file():
        violation(rows, module_name, "candidate_verifier_script", "candidate verifier script does not exist")
    if not POWERSHELL_FUNCTION_PATTERN.fullmatch(str(function_name)):
        violation(rows, module_name, "candidate_verifier_function", "candidate verifier function name is invalid")


def validate_catalog_relationships(
    manifests: dict[str, dict[str, Any]], module_root: Path, rows: list[dict[str, str]]
) -> tuple[dict[str, str], dict[str, str]]:
    command_owners = _unique_owners(manifests, "commands", rows)
    event_owners = _unique_owners(manifests, "events", rows)
    validate_web_section_ownership(manifests, rows)
    validate_api_prefix_ownership(manifests, rows)
    _validate_dependencies(manifests, rows)
    _validate_backend_packages(manifests, module_root, rows)
    validate_owned_table_claims(manifests, rows)
    return command_owners, event_owners


def _unique_owners(
    manifests: dict[str, dict[str, Any]], field: str, rows: list[dict[str, str]]
) -> dict[str, str]:
    owners: dict[str, str] = {}
    for module_name, manifest in manifests.items():
        for item in manifest[field]:
            if item in owners:
                violation(rows, module_name, field, f"{item} is already owned by {owners[item]}")
            owners[item] = module_name
    return owners


def _validate_dependencies(manifests: dict[str, dict[str, Any]], rows: list[dict[str, str]]) -> None:
    for module_name, manifest in manifests.items():
        for dependency in manifest["dependencies"]:
            if dependency == module_name:
                violation(rows, module_name, "dependencies", "module cannot depend on itself")
            elif dependency not in manifests:
                violation(rows, module_name, "dependencies", f"unknown module dependency: {dependency}")
    visiting: list[str] = []
    visited: set[str] = set()

    def visit(module_name: str) -> None:
        if module_name in visiting:
            cycle = visiting[visiting.index(module_name) :] + [module_name]
            reason = "dependency cycle: " + " -> ".join(cycle)
            if not any(row["field"] == "dependencies" and row["reason"] == reason for row in rows):
                violation(rows, module_name, "dependencies", reason)
            return
        if module_name in visited:
            return
        visiting.append(module_name)
        for dependency in manifests[module_name]["dependencies"]:
            if dependency in manifests and dependency != module_name:
                visit(dependency)
        visiting.pop()
        visited.add(module_name)

    for module_name in manifests:
        visit(module_name)


def _validate_backend_packages(
    manifests: dict[str, dict[str, Any]], module_root: Path, rows: list[dict[str, str]]
) -> None:
    owners: dict[str, str] = {}
    workspace = module_root.parent
    for module_name, manifest in manifests.items():
        backend = workspace / Path(manifest["backend_path"])
        if not backend.is_dir():
            continue
        for package in sorted(backend.iterdir()):
            if not package.is_dir() or not (package / "__init__.py").is_file():
                continue
            package_key = package.name.casefold()
            previous = owners.get(package_key)
            if previous is not None:
                violation(rows, module_name, "backend_path", f"backend package {package.name} is already owned by {previous}")
            owners[package_key] = module_name

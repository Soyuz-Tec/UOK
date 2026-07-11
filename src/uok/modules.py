from __future__ import annotations

from copy import deepcopy
from typing import Any

from .module_contract_validation import validate_module_extension_contracts
from .module_lifecycle_policy import lifecycle_policy_checks
from .module_manifest_loader import load_module_manifests


def module_catalog() -> dict[str, dict[str, Any]]:
    return deepcopy(load_module_manifests())


def module_contracts() -> dict[str, Any]:
    modules = module_catalog()
    extension_contract = validate_module_extension_contracts()
    lifecycle = module_lifecycle_report()
    return {
        "ok": lifecycle["ok"] and extension_contract["ok"],
        "module_count": len(modules),
        "modules": modules,
        "architecture": "modular monolith",
        "module_lifecycle": "manifest-declared maturity, flags, dependencies, and lifecycle states",
        "lifecycle_policy": {"checks": lifecycle["checks"], "module_checks": lifecycle["module_checks"]},
        "source_boundary": "baseline contains no hard-coded domain business modules",
        "extension_contract": extension_contract,
    }


def module_lifecycle_report() -> dict[str, Any]:
    modules = module_catalog()
    catalog_names = set(modules)
    module_checks = {
        name: lifecycle_policy_checks(name, manifest, catalog_names)
        for name, manifest in modules.items()
    }
    check_names = tuple(next(iter(module_checks.values()))) if module_checks else ()
    checks = {"catalog_declared": bool(modules)}
    checks.update({
        check_name: all(values[check_name] for values in module_checks.values())
        for check_name in check_names
    })
    return {
        "ok": all(checks.values()),
        "checks": checks,
        "module_checks": module_checks,
        "modules": modules,
    }

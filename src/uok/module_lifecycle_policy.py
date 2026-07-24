from __future__ import annotations

from typing import Any, Collection

from .module_contract_rules import ALLOWED_LIFECYCLE_STATES
from .module_manifest_schema import MATURITY_LEVELS

MATURITY_VALUES = frozenset(MATURITY_LEVELS)
LIFECYCLE_STATES = frozenset(ALLOWED_LIFECYCLE_STATES)
LIFECYCLE_FLAGS = ("installable", "uninstallable", "updatable", "maintainable", "required")
ACTION_TARGETS = {
    "install": "installed",
    "uninstall": "uninstalled",
    "disable": "disabled",
    "enable": "installed",
    "upgrade": "upgraded",
}
ACTION_FLAGS = {
    "install": "installable",
    "uninstall": "uninstallable",
    "upgrade": "updatable",
    "maintenance": "maintainable",
}
ACTION_SOURCE_STATES = {
    "install": {"available", "uninstalled", "installed", "upgraded"},
    "uninstall": {"installed", "upgraded", "disabled"},
    "disable": {"installed", "upgraded"},
    "enable": {"disabled"},
    "upgrade": {"installed", "upgraded"},
}


def manifest_maturity(manifest: dict[str, Any]) -> str:
    return str(manifest.get("maturity", "source_present"))


def manifest_lifecycle(manifest: dict[str, Any]) -> list[str]:
    return [str(state) for state in manifest.get("lifecycle", [])]


def default_module_status(manifest: dict[str, Any]) -> str:
    lifecycle = manifest_lifecycle(manifest)
    if manifest_maturity(manifest) == "planned":
        return "planned"
    if manifest.get("required") is True and "installed" in lifecycle:
        return "installed"
    if "available" in lifecycle:
        return "available"
    return lifecycle[0] if lifecycle else "available"


def ensure_action_supported(manifest: dict[str, Any], action: str) -> None:
    maturity = manifest_maturity(manifest)
    if maturity == "planned" and action in {"install", "upgrade"}:
        verb = "installed" if action == "install" else "upgraded"
        raise ValueError(f"planned module cannot be {verb}")
    if action in {"disable", "uninstall"} and manifest.get("required") is True:
        verb = "disabled" if action == "disable" else "uninstalled"
        raise ValueError(f"required module cannot be {verb}")

    flag = ACTION_FLAGS.get(action)
    if flag and manifest.get(flag) is not True:
        adjective = {
            "installable": "installable",
            "uninstallable": "uninstallable",
            "updatable": "updatable",
            "maintainable": "maintainable",
        }[flag]
        raise ValueError(f"module is not {adjective}")

    target = ACTION_TARGETS.get(action)
    if target and target not in manifest_lifecycle(manifest):
        raise ValueError(f"module lifecycle does not support {action}")


def ensure_status_transition(manifest: dict[str, Any], action: str, current_status: str) -> None:
    if current_status not in manifest_lifecycle(manifest):
        raise ValueError(f"module status is not declared by its lifecycle: {current_status}")
    allowed = ACTION_SOURCE_STATES.get(action)
    if allowed is not None and current_status not in allowed:
        raise ValueError(f"module status {current_status} does not support {action}")


def lifecycle_policy_checks(
    module_name: str,
    manifest: dict[str, Any],
    catalog_names: Collection[str],
) -> dict[str, bool]:
    maturity = manifest_maturity(manifest)
    lifecycle = manifest_lifecycle(manifest)
    lifecycle_set = set(lifecycle)
    required = manifest.get("required") is True
    planned = maturity == "planned"
    dependencies = manifest.get("dependencies", [])
    return {
        "lifecycle_flags_boolean": all(isinstance(manifest.get(field), bool) for field in LIFECYCLE_FLAGS),
        "maturity_values_valid": maturity in MATURITY_VALUES,
        "lifecycle_states_valid": bool(lifecycle)
        and len(lifecycle) == len(lifecycle_set)
        and lifecycle_set <= LIFECYCLE_STATES,
        "required_modules_bootstrap_ready": not required or "installed" in lifecycle_set,
        "required_modules_protected": not required
        or (
            manifest.get("uninstallable") is False
            and "disabled" not in lifecycle_set
            and "uninstalled" not in lifecycle_set
        ),
        "installable_modules_lifecycle_ready": manifest.get("installable") is not True
        or (not planned and "installed" in lifecycle_set and (required or "available" in lifecycle_set)),
        "uninstallable_modules_lifecycle_ready": manifest.get("uninstallable") is not True
        or (not required and "uninstalled" in lifecycle_set),
        "updatable_modules_lifecycle_ready": manifest.get("updatable") is not True
        or (not planned and "upgraded" in lifecycle_set),
        "planned_modules_inert": not planned
        or (
            not required
            and lifecycle == ["planned"]
            and all(manifest.get(field) is False for field in LIFECYCLE_FLAGS[:-1])
        ),
        "optional_modules_default_ready": planned or required or "available" in lifecycle_set,
        "dependencies_declared": isinstance(dependencies, list)
        and all(
            isinstance(dependency, str)
            and dependency in catalog_names
            and dependency != module_name
            for dependency in dependencies
        ),
    }

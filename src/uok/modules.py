from __future__ import annotations

from copy import deepcopy
from typing import Any

from .module_contract_validation import validate_module_extension_contracts
from .module_manifest_loader import load_module_manifests


def module_catalog() -> dict[str, dict[str, Any]]:
    return deepcopy(load_module_manifests())


def module_contracts() -> dict[str, Any]:
    modules = module_catalog()
    extension_contract = validate_module_extension_contracts()
    return {
        "ok": all(
            module["kind"] in {"control_module", "capability_module", "business_module"}
            and module.get("installable") is True
            and (module.get("uninstallable") is True or module.get("required") is True)
            and module.get("updatable") is True
            and module.get("maintainable") is True
            and isinstance(module["commands"], list)
            and isinstance(module["events"], list)
            and isinstance(module["dependencies"], list)
            for module in modules.values()
        ) and extension_contract["ok"],
        "module_count": len(modules),
        "modules": modules,
        "architecture": "modular monolith",
        "module_lifecycle": "required Apps Manager plus optional installable modules",
        "source_boundary": "baseline contains no hard-coded domain business modules",
        "extension_contract": extension_contract,
    }


def module_lifecycle_report() -> dict[str, Any]:
    modules = module_catalog()
    checks = {
        "apps_manager_declared": "apps.manager" in modules,
        "contacts_declared_as_available_module": "contacts.core" in modules,
        "only_apps_manager_required": sorted(name for name, module in modules.items() if module.get("required")) == ["apps.manager"],
        "no_business_modules_declared": all(module["kind"] != "business_module" for module in modules.values()),
        "apps_manager_installable": modules["apps.manager"]["installable"] is True,
        "apps_manager_bootstrap_required": modules["apps.manager"].get("required") is True,
        "apps_manager_not_uninstallable_while_required": modules["apps.manager"]["uninstallable"] is False,
        "apps_manager_separately_updatable": modules["apps.manager"]["updatable"] is True,
        "apps_manager_maintainable": modules["apps.manager"]["maintainable"] is True,
        "apps_manager_has_no_dependencies": modules["apps.manager"]["dependencies"] == [],
        "contacts_installable": modules["contacts.core"]["installable"] is True,
        "contacts_optional": modules["contacts.core"].get("required") is False,
        "contacts_uninstallable": modules["contacts.core"]["uninstallable"] is True,
        "contacts_separately_updatable": modules["contacts.core"]["updatable"] is True,
        "contacts_maintainable": modules["contacts.core"]["maintainable"] is True,
        "contacts_has_no_dependencies": modules["contacts.core"]["dependencies"] == [],
    }
    return {"ok": all(checks.values()), "checks": checks, "modules": modules}

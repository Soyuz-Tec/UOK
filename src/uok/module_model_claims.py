from __future__ import annotations

import re
from typing import Any


MODEL_OWNER_PATTERN = re.compile(
    r"^[A-Z][A-Za-z0-9]*(?::[A-Za-z0-9][A-Za-z0-9_.-]*)?$"
)
KERNEL_MODEL_NAMES = frozenset({
    "Organization",
    "User",
    "Membership",
    "SchemaVersion",
    "GovernanceRule",
    "ModuleRecord",
    "WorkflowInstance",
    "CommandLog",
    "EventRecord",
})
SCOPABLE_KERNEL_MODEL_CLAIMS = frozenset({
    "ModuleRecord",
    "CommandLog",
    "EventRecord",
})


def validate_owned_table_claims(
    manifests: dict[str, dict[str, Any]],
    rows: list[dict[str, str]],
) -> None:
    direct_owners: dict[str, str] = {}
    scoped_owners: dict[tuple[str, str], str] = {}
    for module_name, manifest in manifests.items():
        has_direct_models = False
        for raw_owner in manifest["owned_tables"]:
            owner = str(raw_owner)
            if not MODEL_OWNER_PATTERN.fullmatch(owner):
                _violation(
                    rows,
                    module_name,
                    f"invalid model ownership declaration: {owner}",
                )
                continue
            model_name, separator, scope = owner.partition(":")
            if model_name in KERNEL_MODEL_NAMES:
                if model_name not in SCOPABLE_KERNEL_MODEL_CLAIMS:
                    _violation(
                        rows,
                        module_name,
                        f"kernel model {model_name} cannot be claimed by a module",
                    )
                    continue
                if not separator:
                    _violation(
                        rows,
                        module_name,
                        f"kernel model {model_name} requires an explicit ownership scope",
                    )
                    continue
                if model_name == "ModuleRecord" and (
                    module_name != "apps.manager" or scope != "apps.manager"
                ):
                    _violation(
                        rows,
                        module_name,
                        "ModuleRecord may only be scoped to apps.manager",
                    )
                    continue
                if model_name == "CommandLog" and scope != module_name:
                    _violation(
                        rows,
                        module_name,
                        f"CommandLog scope must equal declaring module {module_name}",
                    )
                    continue
                key = (model_name, scope.casefold())
                previous = scoped_owners.get(key)
                if previous is not None:
                    _violation(
                        rows,
                        module_name,
                        f"{owner} is already claimed by {previous}",
                    )
                scoped_owners[key] = module_name
                continue
            if separator:
                _violation(
                    rows,
                    module_name,
                    f"module model {model_name} cannot use a shared-table scope",
                )
                continue
            has_direct_models = True
            previous = direct_owners.get(model_name)
            if previous is not None:
                _violation(
                    rows,
                    module_name,
                    f"{model_name} is already owned by {previous}",
                )
            direct_owners[model_name] = module_name
        if has_direct_models and not manifest.get("model_exports"):
            _violation(
                rows,
                module_name,
                "direct model ownership requires model_exports",
            )


def _violation(
    rows: list[dict[str, str]],
    module_name: str,
    reason: str,
) -> None:
    rows.append({"module": module_name, "field": "owned_tables", "reason": reason})

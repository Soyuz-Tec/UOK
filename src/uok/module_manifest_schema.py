from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal


MANIFEST_SCHEMA = "uok.module.v1"
MATURITY_LEVELS = (
    "planned",
    "source_present",
    "unit_tested",
    "integration_tested",
    "runtime_proven",
)
REQUIRED_MANIFEST_FIELDS = {
    "manifest_schema",
    "name",
    "kind",
    "version",
    "description",
    "maturity",
    "installable",
    "uninstallable",
    "updatable",
    "maintainable",
    "required",
    "lifecycle",
    "commands",
    "events",
    "dependencies",
    "backend_path",
    "web_path",
    "migrations_path",
    "tests_path",
    "api_prefixes",
    "permissions",
    "owned_tables",
    "extension_points",
    "data_retention_policy",
}
STRING_FIELDS = {
    "manifest_schema",
    "name",
    "kind",
    "version",
    "description",
    "maturity",
    "backend_path",
    "web_path",
    "migrations_path",
    "tests_path",
    "data_retention_policy",
}
BOOLEAN_FIELDS = {"installable", "uninstallable", "updatable", "maintainable", "required"}
LIST_FIELDS = {
    "lifecycle",
    "commands",
    "events",
    "dependencies",
    "api_prefixes",
    "permissions",
    "owned_tables",
    "extension_points",
}


@dataclass(frozen=True)
class ExtensionSpec:
    fields: tuple[str, ...]
    category: Literal["runtime", "release"] = "runtime"


EXTENSION_REGISTRY = {
    "api_router": ExtensionSpec(("api_router",)),
    "command_handlers": ExtensionSpec(("command_handlers",)),
    "command_permissions": ExtensionSpec(("command_permissions",)),
    "command_replay_guard": ExtensionSpec(("command_replay_guard",)),
    "role_grants": ExtensionSpec(("role_grants",)),
    "dashboard_provider": ExtensionSpec(("dashboard_provider",)),
    "evidence_provider": ExtensionSpec(("evidence_provider",)),
    "model_exports": ExtensionSpec(("model_exports",)),
    "web_surface": ExtensionSpec(
        ("web_entry", "web_section"),
        category="release",
    ),
    "candidate_verifier": ExtensionSpec(
        ("candidate_verifier_script", "candidate_verifier_function"),
        category="release",
    ),
}
OPTIONAL_MANIFEST_FIELDS = {
    field for extension in EXTENSION_REGISTRY.values() for field in extension.fields
}
IMPORT_TARGET_FIELDS = {
    field
    for extension in EXTENSION_REGISTRY.values()
    if extension.category == "runtime"
    for field in extension.fields
}
STRING_FIELDS |= OPTIONAL_MANIFEST_FIELDS
ALLOWED_MANIFEST_FIELDS = REQUIRED_MANIFEST_FIELDS | OPTIONAL_MANIFEST_FIELDS


def validate_manifest_shape(data: dict[str, Any], path: Path) -> None:
    missing = sorted(REQUIRED_MANIFEST_FIELDS - set(data))
    if missing:
        raise ValueError(f"{path} is missing required fields: {', '.join(missing)}")
    unknown = sorted(set(data) - ALLOWED_MANIFEST_FIELDS)
    if unknown:
        raise ValueError(f"{path} has unknown fields: {', '.join(unknown)}")

    for field in sorted(STRING_FIELDS):
        if field not in data:
            continue
        if not isinstance(data[field], str) or not data[field].strip():
            raise ValueError(f"{path} field {field} must be a non-empty string")
    for field in sorted(BOOLEAN_FIELDS):
        if type(data[field]) is not bool:
            raise ValueError(f"{path} field {field} must be a boolean")
    for field in sorted(LIST_FIELDS):
        value = data[field]
        if not isinstance(value, list):
            raise ValueError(f"{path} field {field} must be a list")
        if any(not isinstance(item, str) or not item.strip() for item in value):
            raise ValueError(f"{path} field {field} must contain non-empty strings")
        if len(value) != len(set(value)):
            raise ValueError(f"{path} field {field} contains duplicate values")

    if data["manifest_schema"] != MANIFEST_SCHEMA:
        raise ValueError(f"{path} manifest_schema must be {MANIFEST_SCHEMA}")
    if data["maturity"] not in MATURITY_LEVELS:
        allowed = ", ".join(MATURITY_LEVELS)
        raise ValueError(f"{path} maturity must be one of: {allowed}")
    _validate_extension_declarations(data, path)


def _validate_extension_declarations(data: dict[str, Any], path: Path) -> None:
    declared = set(data["extension_points"])
    unknown = sorted(declared - set(EXTENSION_REGISTRY))
    if unknown:
        raise ValueError(f"{path} has unknown extension points: {', '.join(unknown)}")
    for extension_name, spec in EXTENSION_REGISTRY.items():
        present_fields = [field for field in spec.fields if field in data]
        if extension_name in declared:
            missing = [field for field in spec.fields if field not in data]
            if missing:
                raise ValueError(
                    f"{path} extension {extension_name} requires fields: {', '.join(missing)}"
                )
        elif present_fields:
            raise ValueError(
                f"{path} fields {', '.join(present_fields)} require extension {extension_name}"
            )

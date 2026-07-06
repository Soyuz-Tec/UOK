from __future__ import annotations

from pathlib import Path
from typing import Any

from . import APP_VERSION
from .module_paths import modules_root

REQUIRED_MANIFEST_FIELDS = {
    "name",
    "kind",
    "version",
    "description",
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
LIST_FIELDS = {"lifecycle", "commands", "events", "dependencies", "api_prefixes", "permissions", "owned_tables", "extension_points"}


def load_module_manifests(root: Path | None = None) -> dict[str, dict[str, Any]]:
    module_root = root or modules_root()
    if not module_root.exists():
        return {}
    manifests: dict[str, dict[str, Any]] = {}
    for module_dir in sorted(module_root.iterdir()):
        if not module_dir.is_dir():
            continue
        manifest_path = module_dir / "manifest.yaml"
        if not manifest_path.exists():
            continue
        manifest = load_module_manifest(manifest_path)
        if manifest["name"] != module_dir.name:
            raise ValueError(f"{manifest_path} name must match directory {module_dir.name}")
        manifests[manifest["name"]] = manifest
    return manifests


def load_module_manifest(path: Path) -> dict[str, Any]:
    data = _parse_manifest_yaml(path.read_text(encoding="utf-8"), path)
    missing = sorted(REQUIRED_MANIFEST_FIELDS - set(data))
    if missing:
        raise ValueError(f"{path} is missing required fields: {', '.join(missing)}")
    for field in LIST_FIELDS:
        if not isinstance(data[field], list):
            raise ValueError(f"{path} field {field} must be a list")
    return data


def _parse_manifest_yaml(text: str, path: Path) -> dict[str, Any]:
    data: dict[str, Any] = {}
    current_list: str | None = None
    for line_number, raw_line in enumerate(text.splitlines(), start=1):
        line = raw_line.split("#", 1)[0].rstrip()
        if not line.strip():
            continue
        stripped = line.strip()
        if not line.startswith((" ", "\t")) and ":" in line:
            key, raw_value = line.split(":", 1)
            key = key.strip()
            value = raw_value.strip()
            if not key:
                raise ValueError(f"{path}:{line_number} has an empty manifest key")
            if not value:
                data[key] = []
                current_list = key
            else:
                data[key] = _parse_scalar(value)
                current_list = None
            continue
        if current_list and stripped.startswith("- "):
            data[current_list].append(_parse_scalar(stripped[2:].strip()))
            continue
        raise ValueError(f"{path}:{line_number} is not supported by the UOK manifest subset")
    return data


def _parse_scalar(value: str) -> Any:
    if value == "APP_VERSION":
        return APP_VERSION
    if value == "[]":
        return []
    if value == "true":
        return True
    if value == "false":
        return False
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value

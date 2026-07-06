from __future__ import annotations

import re
from importlib import import_module
from pathlib import Path
from typing import Any

from .module_paths import ensure_module_backend_paths, repo_root

IMPORT_TARGET_SPEC_PATTERN = re.compile(r"^[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)+:[a-z_][a-z0-9_]*$")


def module_import_backend_package(spec: str) -> str:
    return spec.partition(":")[0].split(".")[0]


def module_import_backend_package_exists(manifest: dict[str, Any], spec: str) -> bool:
    backend_package = module_import_backend_package(spec)
    backend_path = Path(str(manifest.get("backend_path", "")))
    return (repo_root() / backend_path / backend_package / "__init__.py").is_file()


def resolve_module_import(module_name: str, manifest: dict[str, Any], field: str) -> Any:
    spec = manifest.get(field)
    if not isinstance(spec, str) or not IMPORT_TARGET_SPEC_PATTERN.fullmatch(spec):
        raise ValueError(f"module {module_name} {field} must use <package.module>:<attribute>")
    if not module_import_backend_package_exists(manifest, spec):
        raise ValueError(f"module {module_name} {field} must resolve from the module backend package")
    ensure_module_backend_paths()
    target, _, attribute = spec.partition(":")
    resolved = getattr(import_module(target), attribute, None)
    if resolved is None:
        raise ValueError(f"module {module_name} {field} target {spec} was not found")
    return resolved

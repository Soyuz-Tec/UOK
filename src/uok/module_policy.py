from __future__ import annotations

from functools import lru_cache

from .module_imports import resolve_module_import
from .module_manifest_loader import load_module_manifests


@lru_cache(maxsize=1)
def module_role_grants() -> dict[str, set[str]]:
    grants: dict[str, set[str]] = {}
    for module_name, manifest in load_module_manifests().items():
        if manifest.get("role_grants") is None:
            continue
        provider = resolve_module_import(module_name, manifest, "role_grants")
        mapping = provider() if callable(provider) else provider
        if not isinstance(mapping, dict):
            raise ValueError(f"module {module_name} role_grants must return a mapping")
        declared_permissions = set(str(permission) for permission in manifest.get("permissions", []))
        for role, permissions in mapping.items():
            if not isinstance(permissions, (list, tuple, set)):
                raise ValueError(f"module {module_name} role_grants for {role} must be a list")
            normalized = {str(permission) for permission in permissions}
            undeclared = sorted(normalized - declared_permissions)
            if undeclared:
                raise ValueError(f"module {module_name} role_grants for {role} use undeclared permissions: {', '.join(undeclared)}")
            grants.setdefault(str(role), set()).update(normalized)
    return grants

from __future__ import annotations

from functools import lru_cache
from typing import Any, Callable

from sqlalchemy.orm import Session

from .module_imports import resolve_module_import
from .module_manifest_loader import load_module_manifests
from .security_types import ActorProtocol

CommandHandler = Callable[[Session, ActorProtocol, dict[str, Any], str], dict[str, Any]]

KERNEL_COMMAND_PERMISSIONS = {
    "VerifyBaseline": "migration.verify",
}


@lru_cache(maxsize=1)
def load_module_command_handlers() -> dict[str, CommandHandler]:
    handlers: dict[str, CommandHandler] = {}
    for module_name, manifest in load_module_manifests().items():
        if manifest.get("command_handlers") is None:
            continue
        provider = resolve_module_import(module_name, manifest, "command_handlers")
        mapping = provider() if callable(provider) else provider
        if not isinstance(mapping, dict):
            raise ValueError(f"module {module_name} command_handlers must return a mapping")
        declared = set(str(command) for command in manifest.get("commands", []))
        for command_type, handler in mapping.items():
            if command_type not in declared:
                raise ValueError(f"module {module_name} command_handlers returned undeclared command {command_type}")
            if command_type in handlers:
                raise ValueError(f"command {command_type} is already registered")
            if not callable(handler):
                raise ValueError(f"module {module_name} command handler for {command_type} is not callable")
            handlers[str(command_type)] = handler
        missing = sorted(declared - set(mapping))
        if missing:
            raise ValueError(f"module {module_name} is missing command handlers for: {', '.join(missing)}")
    return handlers


@lru_cache(maxsize=1)
def load_module_command_permissions() -> dict[str, str]:
    permissions: dict[str, str] = {}
    for module_name, manifest in load_module_manifests().items():
        if manifest.get("command_permissions") is None:
            continue
        provider = resolve_module_import(module_name, manifest, "command_permissions")
        mapping = provider() if callable(provider) else provider
        if not isinstance(mapping, dict):
            raise ValueError(f"module {module_name} command_permissions must return a mapping")
        declared_commands = set(str(command) for command in manifest.get("commands", []))
        declared_permissions = set(str(permission) for permission in manifest.get("permissions", []))
        for command_type, permission in mapping.items():
            if command_type not in declared_commands:
                raise ValueError(f"module {module_name} command_permissions returned undeclared command {command_type}")
            if permission not in declared_permissions:
                raise ValueError(f"module {module_name} command {command_type} uses undeclared permission {permission}")
            permissions[str(command_type)] = str(permission)
        missing = sorted(declared_commands - set(mapping))
        if missing:
            raise ValueError(f"module {module_name} is missing command permissions for: {', '.join(missing)}")
    return permissions


def command_permissions() -> dict[str, str]:
    return {**KERNEL_COMMAND_PERMISSIONS, **load_module_command_permissions()}

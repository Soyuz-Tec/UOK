from __future__ import annotations

import importlib
from collections.abc import Callable
from typing import Any

from .module_paths import ensure_module_backend_paths
from .modules import module_catalog

CommandHandler = Callable[..., dict[str, Any]]


def module_backend_package(module_name: str) -> str:
    return f"uok_{module_name.replace('.', '_')}"


def _optional_import(module_name: str):
    try:
        return importlib.import_module(module_name)
    except ModuleNotFoundError as exc:
        if exc.name == module_name:
            return None
        raise


def load_module_command_handlers() -> dict[str, CommandHandler]:
    ensure_module_backend_paths()
    handlers: dict[str, CommandHandler] = {}
    for module_name in sorted(module_catalog()):
        commands_module = _optional_import(f"{module_backend_package(module_name)}.commands")
        if commands_module is None or not hasattr(commands_module, "command_handlers"):
            continue
        for command_type, handler in commands_module.command_handlers().items():
            if command_type in handlers:
                raise ValueError(f"command {command_type} is registered more than once")
            handlers[command_type] = handler
    return handlers


def load_module_command_permissions() -> dict[str, str]:
    ensure_module_backend_paths()
    permissions: dict[str, str] = {}
    for module_name in sorted(module_catalog()):
        commands_module = _optional_import(f"{module_backend_package(module_name)}.commands")
        if commands_module is None or not hasattr(commands_module, "command_permissions"):
            continue
        for command_type, permission in commands_module.command_permissions().items():
            if command_type in permissions:
                raise ValueError(f"command permission {command_type} is registered more than once")
            permissions[command_type] = permission
    return permissions

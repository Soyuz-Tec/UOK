from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any


OPERATIONAL_STATUSES = frozenset({"installed", "upgraded"})
DatabaseSession = Any
ModuleResult = dict[str, Any]
LifecycleOperation = Callable[[DatabaseSession, str, str], ModuleResult]


@dataclass(frozen=True)
class ModuleRuntimePort:
    """Module-neutral operations supplied once by the host composition root."""

    catalog: Callable[[], dict[str, dict[str, Any]]]
    contracts: Callable[[], dict[str, Any]]
    lifecycle_report: Callable[[], dict[str, Any]]
    status: Callable[[DatabaseSession, str, str], ModuleResult]
    maintenance_report: Callable[[DatabaseSession, str, str], ModuleResult]
    install: LifecycleOperation
    uninstall: LifecycleOperation
    disable: LifecycleOperation
    enable: LifecycleOperation
    upgrade: LifecycleOperation
    reconcile: LifecycleOperation
    ensure_operational: Callable[[DatabaseSession, str, str], None]
    record_status: Callable[[DatabaseSession, str, str], str | None]


_runtime: ModuleRuntimePort | None = None


def configure_module_runtime(runtime: ModuleRuntimePort) -> None:
    global _runtime
    _runtime = runtime


def module_runtime_configured() -> bool:
    return _runtime is not None


def module_catalog() -> dict[str, dict[str, Any]]:
    return _configured_runtime().catalog()


def module_contracts() -> dict[str, Any]:
    return _configured_runtime().contracts()


def module_lifecycle_report() -> dict[str, Any]:
    return _configured_runtime().lifecycle_report()


def module_status(db: DatabaseSession, organization_id: str, module_name: str) -> ModuleResult:
    return _configured_runtime().status(db, organization_id, module_name)


def module_maintenance_report(
    db: DatabaseSession,
    organization_id: str,
    module_name: str,
) -> ModuleResult:
    return _configured_runtime().maintenance_report(db, organization_id, module_name)


def install_module(db: DatabaseSession, organization_id: str, module_name: str) -> ModuleResult:
    return _configured_runtime().install(db, organization_id, module_name)


def uninstall_module(db: DatabaseSession, organization_id: str, module_name: str) -> ModuleResult:
    return _configured_runtime().uninstall(db, organization_id, module_name)


def disable_module(db: DatabaseSession, organization_id: str, module_name: str) -> ModuleResult:
    return _configured_runtime().disable(db, organization_id, module_name)


def enable_module(db: DatabaseSession, organization_id: str, module_name: str) -> ModuleResult:
    return _configured_runtime().enable(db, organization_id, module_name)


def upgrade_module(db: DatabaseSession, organization_id: str, module_name: str) -> ModuleResult:
    return _configured_runtime().upgrade(db, organization_id, module_name)


def reconcile_module_record(
    db: DatabaseSession,
    organization_id: str,
    module_name: str,
) -> ModuleResult:
    return _configured_runtime().reconcile(db, organization_id, module_name)


def ensure_module_operational(db: DatabaseSession, organization_id: str, module_name: str) -> None:
    _configured_runtime().ensure_operational(db, organization_id, module_name)


def module_record_status(db: DatabaseSession, organization_id: str, module_name: str) -> str | None:
    return _configured_runtime().record_status(db, organization_id, module_name)


def module_declared(module_name: str) -> bool:
    return module_name in module_catalog()


def _configured_runtime() -> ModuleRuntimePort:
    if _runtime is None:
        raise RuntimeError("module runtime is not configured; import the UOK host application")
    return _runtime


__all__ = [
    "ModuleRuntimePort",
    "OPERATIONAL_STATUSES",
    "configure_module_runtime",
    "disable_module",
    "enable_module",
    "ensure_module_operational",
    "install_module",
    "module_catalog",
    "module_contracts",
    "module_declared",
    "module_lifecycle_report",
    "module_maintenance_report",
    "module_record_status",
    "module_runtime_configured",
    "module_status",
    "reconcile_module_record",
    "uninstall_module",
    "upgrade_module",
]

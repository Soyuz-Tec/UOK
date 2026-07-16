from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass


KERNEL_ROLE_PERMISSIONS = {
    "platform_admin": {"*"},
    "ops_manager": {
        "module.read",
        "evidence.read",
        "migration.verify",
        "architecture.read",
    },
    "trader": {"module.read", "evidence.read"},
    "finance_manager": {"module.read", "evidence.read"},
    "viewer": {"module.read", "evidence.read"},
    "registered_user": {"module.read"},
    "pending_user": {"module.read"},
}
ROLE_PERMISSIONS = KERNEL_ROLE_PERMISSIONS
RoleGrantsProvider = Callable[[], dict[str, set[str]]]


@dataclass(frozen=True)
class Actor:
    user_id: str
    username: str
    organization_id: str
    role: str


_role_grants_provider: RoleGrantsProvider | None = None


def configure_role_grants(provider: RoleGrantsProvider) -> None:
    global _role_grants_provider
    _role_grants_provider = provider


def role_grants_configured() -> bool:
    return _role_grants_provider is not None


def effective_role_permissions() -> dict[str, set[str]]:
    if _role_grants_provider is None:
        raise RuntimeError("security policy is not configured; import the UOK host application")
    permissions = {role: set(values) for role, values in KERNEL_ROLE_PERMISSIONS.items()}
    for role, grants in _role_grants_provider().items():
        permissions.setdefault(role, set()).update(grants)
    return permissions


def has_permission(actor: Actor, permission: str) -> bool:
    permissions = effective_role_permissions().get(actor.role, set())
    return "*" in permissions or permission in permissions


def require_permission(actor: Actor, permission: str) -> None:
    if not has_permission(actor, permission):
        raise PermissionError(permission)


__all__ = [
    "Actor",
    "KERNEL_ROLE_PERMISSIONS",
    "ROLE_PERMISSIONS",
    "effective_role_permissions",
    "has_permission",
    "require_permission",
    "role_grants_configured",
]

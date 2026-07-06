from __future__ import annotations

CONTACTS_ROLE_GRANTS = {
    "ops_manager": {
        "contacts.read",
        "contacts.manage",
        "contacts.import",
        "contacts.restore",
    },
    "trader": {"contacts.read"},
    "finance_manager": {"contacts.read"},
    "viewer": {"contacts.read"},
}


def role_grants() -> dict[str, set[str]]:
    return {role: set(permissions) for role, permissions in CONTACTS_ROLE_GRANTS.items()}

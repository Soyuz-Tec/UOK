from __future__ import annotations

CONTACTS_ROLE_GRANTS = {
    "ops_manager": {
        "contacts.read",
        "contacts.manage",
        "contacts.import",
        "contacts.restore",
        "contacts.bulk",
        "contacts.consent",
        "contacts.customize",
        "contacts.dedupe",
        "contacts.export",
        "contacts.sync",
        "contacts.team.manage",
    },
    "trader": {"contacts.read"},
    "finance_manager": {"contacts.read"},
    "viewer": {"contacts.read"},
}


def role_grants() -> dict[str, set[str]]:
    return {role: set(permissions) for role, permissions in CONTACTS_ROLE_GRANTS.items()}

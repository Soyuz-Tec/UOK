# Contacts Core Backend

The Contacts backend implementation lives in `uok_contacts_core`. The `src/uok/contact*.py` files are compatibility facades so existing UOK API imports stay stable while the module owns its implementation.

Current manifest-declared backend surfaces:

- `uok_contacts_core.api:router`
- `uok_contacts_core.commands:command_handlers`
- `uok_contacts_core.commands:command_permissions`
- `uok_contacts_core.policy:role_grants`
- `uok_contacts_core.reports:dashboard_counts`
- `uok_contacts_core.reports:evidence`
- `uok_contacts_core.models:owned_models`

New Contacts backend behavior belongs here first. Kernel files may consume it only through manifest-resolved extension points or existing compatibility facades.

# Contacts Core Backend

The Contacts backend implementation lives in `uok_contacts_core`.

The only supported Python entry for callers outside Contacts is
`uok_contacts_core.public_api`. Its exact surface is:

- immutable `PartyReferenceResolution` and `resolve_party_reference`;
- `api_router`;
- `command_handlers` and `command_permissions`;
- `role_grants`;
- `dashboard_counts` and `evidence`.

ORM registration remains a privileged manifest hook at
`uok_contacts_core._internal.persistence.models:owned_models`; it is not
exported through the public facade. The former `src/uok/contact*.py` broad
compatibility facades have been retired.

Implementation is private and capability-organized below `_internal` as
`delivery`, `registry`, `groups_relationships`, `governance`,
`exchange_quality`, and `persistence`. Contacts-owned code and tests may use
these packages. External production code, engineering scripts, and other
modules may not; `tests/test_module_public_api_boundaries.py` enforces the rule.

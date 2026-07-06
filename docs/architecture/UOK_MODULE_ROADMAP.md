# UOK Module Roadmap

**Status:** UOK-level module index

**Current candidate:** `UOK-3.1.0-alpha.2`

## Module Documentation Rule

Detailed module plans live with the module under:

```text
docs/modules/<module-name>/
```

This keeps modules portable, independently maintainable, and easier to version separately in future builds.

Architecture documents only track UOK-level governance, release targets, and module status.

## Active Modules

| Module | Type | Status | Current target | Plan |
|---|---|---|---|---|
| `apps.manager` | control module | required baseline module | `UOK-3.1.0-alpha.2` | UOK bootstrap control module |
| `contacts.core` | capability module | approved for full CRM slice | `UOK-3.1.0-alpha.2` | `docs/modules/contacts.core/CONTACTS_APP_PLAN.md` |

## Current Target

`UOK-3.1.0-alpha.2` focuses on turning `contacts.core` into a real independently managed Contacts app:

- party model for people and organizations
- three UI views
- review queue
- private internal notes
- relationships
- CSV import
- warning-based duplicate handling
- owner/team-ready permission fields
- archive, restore, and admin purge

## Governance Rule

New modules must not add product-specific behavior to the UOK core. They must expose their contracts through module manifests, typed APIs, migrations, tests, and candidate verification.

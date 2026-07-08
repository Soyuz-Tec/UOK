# UOK Module Roadmap

**Status:** UOK-level module index

**Current candidate:** `UOK-3.1.0-alpha.3`

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
| `apps.manager` | control module | required baseline module | `UOK-3.1.0-alpha.3` | UOK bootstrap control module |
| `agents.core` | capability module | planned scaffold for governed agent operations | `UOK-3.1.0-alpha.3` | `docs/modules/agents.core/AGENTS_CORE_MODULE_PLAN.md` |
| `contacts.core` | capability module | Contacts MVP hardening in progress | `UOK-3.1.0-alpha.3` | `docs/modules/contacts.core/CONTACTS_APP_PLAN.md` |

## Current Target

`UOK-3.1.0-alpha.3` hardens `contacts.core` as the first independently managed Contacts app:

- party model for people and organizations
- three UI views
- review queue
- private internal notes
- relationships
- persistent user-managed contact groups
- CSV import
- warning-based duplicate handling
- owner/team-ready permission fields
- archive, restore, and admin purge
- manifest-declared API router, command handlers, command permissions, role grants, dashboard provider, evidence provider, model exports, and candidate verifier scenario
- module-owned behavior tests under `modules/contacts.core/tests`
- module-owned operational index and contact group migrations under `modules/contacts.core/migrations`
- frontend module surface registry for Contacts composition

It also introduces the `agents.core` scaffold as the next capability boundary for AI-powered business operations:

- governed agent runbooks
- Codex and future tool bindings under UOK approval and audit control
- human approval gates for high-impact actions
- compliance evidence for agent runs
- future Contacts pilot for enrichment and duplicate-cleanup recommendations

## Governance Rule

New modules must not add product-specific behavior to the UOK core. They must expose their contracts through module manifests, typed APIs, command handlers, command permissions, role grants, owned table declarations, migrations, tests, dashboard/evidence providers where applicable, and candidate verification.

## Next Boundary Work

- Move more module-specific React source under module roots while keeping shared shell and controls in `web/src`.
- Keep future schema changes in module-owned migrations instead of expanding the shared initial baseline.

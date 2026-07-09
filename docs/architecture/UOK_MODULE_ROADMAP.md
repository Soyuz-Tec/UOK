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
| `contacts.core` | capability module | full CRM slice implemented; module-extension baseline accepted | `UOK-3.1.0-alpha.2` | `docs/modules/contacts.core/CONTACTS_APP_PLAN.md` |
| `reports.core` | capability module | secure global report artifact foundation in PR #5 | `UOK-3.1.0-alpha.3` | `docs/reports/SECURE_REPORTS_ARTIFACT_ENGINE.md` |

## Current Target

`UOK-3.1.0-alpha.2` turns `contacts.core` into a real independently managed Contacts app and hardens the module-extension boundary:

- party model for people and organizations
- three UI views
- review queue
- private internal notes
- relationships
- CSV import
- warning-based duplicate handling
- owner/team-ready permission fields
- archive, restore, and admin purge
- manifest-declared API router, command handlers, command permissions, role grants, dashboard provider, evidence provider, model exports, and candidate verifier scenario
- frontend module surface registry for Contacts composition

`reports.core` adds a product-neutral global artifact boundary for JSON, JSONL, TXT, Markdown, CSV, and TSV report generation before richer PDF, office document, spreadsheet, image, or conversion adapters are added later.

## Governance Rule

New modules must not add product-specific behavior to the UOK core. They must expose their contracts through module manifests, typed APIs, command handlers, command permissions, role grants, owned table declarations, migrations, tests, dashboard/evidence providers where applicable, and candidate verification.

## Next Boundary Work

- Move more module-specific React source under module roots while keeping shared shell and controls in `web/src`.
- Move Contacts behavior pytest suites under `modules/contacts.core/tests` when test discovery can preserve the full UOK gate.
- Introduce module-owned migrations for future schema changes instead of expanding the shared initial baseline.

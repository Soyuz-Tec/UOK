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
| `contacts.core` | capability module | full CRM slice implemented; business intelligence profile branch in draft audit | `UOK-3.1.0-alpha.2` + profile hardening | `docs/modules/contacts.core/CONTACTS_APP_PLAN.md`; `docs/modules/contacts.core/CONTACT_BI_PROFILES_PLAN.md`; `docs/modules/contacts.core/CONTACT_BI_REPORT_DATA_POINTS.md`; `docs/modules/contacts.core/CONTACT_BI_PROFILES_AUDIT.md` |

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

The `feature/contact-bi-profiles` branch extends this target with a native profile layer for every contact:

- profile schema for people, organizations, relationships, governance, sources, confidence, risk flags, and scores
- profile evidence storage under module-owned `Party.attrs_json` slices for the first release
- profile commands and events
- profile REST endpoints
- Contacts read-model/search integration
- Contacts Intelligence pane
- developer handoff and audit artifacts
- peer-report data point catalogue covering aliases, contact points, identifiers, ownership, fraud, AML/KYC, sanctions, scam-risk signals, and future normalized tables

## Governance Rule

New modules must not add product-specific behavior to the UOK core. They must expose their contracts through module manifests, typed APIs, command handlers, command permissions, role grants, owned table declarations, migrations, tests, dashboard/evidence providers where applicable, and candidate verification.

## Next Boundary Work

- Move more module-specific React source under module roots while keeping shared shell and controls in `web/src`.
- Move Contacts behavior pytest suites under `modules/contacts.core/tests` when test discovery can preserve the full UOK gate.
- Introduce module-owned migrations for future schema changes instead of expanding the shared initial baseline.
- Move contact business intelligence profiles from JSON slices to module-owned profile tables when analytics, evidence volume, or purge granularity require it.
- Add enrichment provider adapters only after audit confirms normalized evidence storage, `do_not_enrich` enforcement, rate limits, credentials handling, source terms metadata, and multi-valued data modelling.
- Keep AML/KYC, sanctions, adverse-media, scam/fraud, source-of-funds/source-of-wealth, government ID, and SAR/STR artifacts out of the general contact profile unless restricted permissions, retention, encryption/tokenization, and legal/compliance approvals are in place.

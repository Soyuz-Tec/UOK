# Contacts App Plan

**Module:** `contacts.core`

**Target:** `UOK-3.1.0-alpha.2`

**Status:** Implemented for the alpha.2 module-extension baseline; business intelligence profile hardening and audit now continue on `feature/contact-bi-profiles`.

**Source root:** `modules/contacts.core`

## Purpose

`contacts.core` is the first independently developable UOK application module. It must remain installable, upgradable, disableable, uninstallable, maintainable, and portable without compromising UOK. Its backend implementation lives under `modules/contacts.core/backend/uok_contacts_core`; the `src/uok/contact*.py` files are compatibility facades for stable kernel imports.

The alpha.2 module-extension baseline declares Contacts runtime surfaces in `modules/contacts.core/manifest.yaml`:

- API router;
- command handlers;
- command permissions;
- role grants;
- dashboard count provider;
- baseline evidence provider;
- model/table exports;
- candidate verifier scenario under `modules/contacts.core/tests/verify`.

The first release builds a Contacts Full CRM Slice that starts with practical CRM work and leaves a clear path toward Enterprise MDM. The business intelligence profile extension adds native profile facts, evidence, scoring, and an Intelligence pane without turning UOK into a generic CRM object engine.

## Source Basis

This plan is based on UOK module policy, UOK UI policy, and these Apple references:

- Apple Contacts documentation: https://developer.apple.com/documentation/contacts
- Apple Contacts access workflow: https://developer.apple.com/videos/play/wwdc2024/10121/
- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/
- Apple layout guidance: https://developer.apple.com/design/human-interface-guidelines/layout-and-organization
- Apple lists and tables guidance: https://developer.apple.com/design/human-interface-guidelines/lists-and-tables
- Apple split views guidance: https://developer.apple.com/design/human-interface-guidelines/split-views

Business intelligence profile references and audit standards are maintained in:

- `docs/architecture/UOK_CONTACT_BUSINESS_INTELLIGENCE_PROFILES.md`
- `docs/modules/contacts.core/CONTACT_BI_PROFILES_PLAN.md`
- `docs/modules/contacts.core/CONTACT_BI_PROFILES_AUDIT.md`

## User Decisions

- Start with CRM Core and evolve gradually toward Enterprise MDM.
- Use a party model for people and organizations.
- Support List + Detail, Table Workspace, and Card Directory because different users need different working styles.
- Remember the user's last selected Contacts view; fall back to List + Detail.
- Prioritize fast record work: search, create, edit, save, archive, restore, and quick switching.
- Require at least one meaningful field before saving a party.
- Warn but allow possible duplicates, especially for future offline/mobile workflows.
- Prepare for offline but do not build full offline sync in alpha.2.
- Use mixed permissions: role foundation, ownership, and team-ready fields.
- User delete means archive; admin can restore or purge.
- Notes are private internal timeline entries.
- Search is layered: simple default search plus filters for power users.
- Users can import CSV and correct records; normal users cannot bulk export.
- Imported, incomplete, uncertain, and possible duplicate records appear in a review queue.
- Every contact should be able to expose a native business intelligence profile with normalized facts, source evidence, confidence, governance metadata, and profile-health scoring.

## Domain Model

### Party

One shared model represents both people and organizations.

Required concepts:

- `party_type`: `person` or `organization`
- `display_name`
- `given_name`, `family_name`, and `organization_name` where applicable
- `status`: `active`, `archived`, or `purged`
- `review_state`: `ready`, `needs_review`, `possible_duplicate`, or `incomplete`
- `owner_user_id`
- `visibility_scope`
- `team_id`
- `source`
- `client_reference`
- `sync_state`
- `created_at`, `updated_at`, `archived_at`, `purged_at`

### Contact Methods

The first release may store email, phone, website, and address values inside module-owned JSON attributes as long as API contracts expose typed fields. Future releases may split them into dedicated tables if repeated values, validation, and dedupe need stronger relational behavior.

### Relationships

Relationships connect parties with explicit labels.

Examples:

- `works_for`
- `primary_contact`
- `billing_contact`
- `decision_maker`
- `advisor`
- `supplier`
- `customer`

### Notes

Notes are private internal timeline entries, stored separately from the editable party profile and included in audit/event evidence.

### Import Batches

CSV import creates an import batch and records per-row results. Imported rows may create parties in `needs_review`, `possible_duplicate`, or `incomplete` review states.

### Business Intelligence Profile

The profile extension stores module-owned JSON slices on `Party.attrs_json` for the first release:

- `business_profile`
- `business_profile_evidence`

The profile includes:

- concise summary;
- person intelligence;
- organization intelligence;
- relationship intelligence;
- governance controls;
- source provenance;
- confidence;
- risk flags;
- computed scores.

The developer handoff and acceptance gates live in `docs/modules/contacts.core/CONTACT_BI_PROFILES_PLAN.md`. The audit checklist lives in `docs/modules/contacts.core/CONTACT_BI_PROFILES_AUDIT.md`.

## API Scope

Required endpoints for alpha.2:

- List/search parties.
- Read party detail.
- Create party.
- Update party.
- Archive party.
- Restore party.
- Purge party, admin only.
- List/add notes.
- List/add relationships.
- Import CSV rows.
- List review queue.
- Read module readiness/evidence.

Business intelligence profile endpoints for the profile branch:

- `GET /api/contacts/{party_id}/profile`
- `PATCH /api/contacts/{party_id}/profile`
- `POST /api/contacts/{party_id}/profile/evidence`
- `GET /api/contacts/{party_id}/profile/evidence`
- `POST /api/contacts/{party_id}/profile/rebuild`

All public API contracts must be OpenAPI-compatible and reflected in the generated TypeScript client when client generation is part of the current build process.

The command bus must discover Contacts commands through the manifest `command_handlers` provider instead of importing Contacts handlers directly into `src/uok/commands.py`.

## UI Scope

The Contacts UI must be human-friendly and policy-aligned:

- View switcher: List + Detail, Table, Cards.
- Last selected view persists per browser.
- Search box is always available.
- Filters are available without overwhelming simple users.
- List + Detail is the fallback default.
- Table supports dense review and correction.
- Cards support recognition-focused browsing.
- Review Queue is visible and actionable.
- Create/edit form supports minimal save with at least one meaningful field.
- Validation errors are specific and close to the affected fields.
- Module disabled/uninstalled states are clear and route users back to Apps Manager actions.
- Light, dark, and system appearances remain supported.
- Detail pane includes Overview, Intelligence, Activity, and Relationships.
- Intelligence pane renders profile summary, confidence, source count, profile health, completeness, tags, risk flags, update timestamp, and normalized-facts-only status.

Current UI source remains in `web/src/features/contacts` and is composed through `web/src/features/modules/moduleSurfaceRegistry.tsx`. The module root `modules/contacts.core/web` remains the ownership marker until a future packaging step moves executable module UI behind the module root.

## Permission Scope

Initial permission behavior:

- `platform_admin`: full module and record management, restore, purge, reassignment.
- `ops_manager`: create, edit, archive, restore permitted records, import CSV, manage notes, relationships, and business profiles.
- `viewer`, `trader`, `finance_manager`: read permitted records and readable profile summaries/details.

Ownership and team fields must exist in the data/API shape even if full team enforcement matures later.

Role grants are declared by `uok_contacts_core.policy:role_grants` and merged into kernel permissions at authorization time. Contacts permission atoms must not be hardcoded in `src/uok/security.py`.

Profile write/evidence/rebuild commands require `contacts.manage`; profile reads require `contacts.read` and normal readable-party checks.

## Evidence And Dashboard Scope

Contacts dashboard counts and baseline evidence checks are module-owned providers:

- `uok_contacts_core.reports:dashboard_counts`
- `uok_contacts_core.reports:evidence`

The kernel owns the stable `/api/dashboard` and `/api/baseline-evidence` response shapes, while Contacts owns its module-specific fragments.

Profile mutation evidence is emitted through:

- `ContactProfileUpdated`
- `ContactProfileEvidenceRecorded`
- `ContactProfileRebuilt`

## Acceptance Gates

Before packaging `UOK-3.1.0-alpha.2` or moving the profile PR out of draft:

```powershell
python -m compileall -q src modules tests
python -m pytest -q
npm --prefix web test
npm --prefix web run build:static
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify_uok_candidate.ps1
```

Browser verification must confirm:

- title and main heading use `UOK`
- Contacts app exposes the three views
- Review Queue appears
- CSV import UI appears
- Intelligence pane appears in contact detail
- profile summary and scores render after evidence is recorded
- viewer can read allowed profiles but cannot write profile evidence
- no retired UOK names appear
- no product-specific labels appear
- no console errors appear

Profile audit must also complete `docs/modules/contacts.core/CONTACT_BI_PROFILES_AUDIT.md`.

## Remaining Packaging Work

- Move more Contacts React source under `modules/contacts.core/web` when the frontend build can preserve shared shell composition.
- Move Contacts behavior pytest suites from top-level `tests/` into `modules/contacts.core/tests` when test discovery remains equivalent.
- Add future Contacts schema migrations under `modules/contacts.core/migrations` instead of expanding the shared initial baseline.
- Add external enrichment adapters only after the profile foundation passes audit and deployment policy configures credentials, allowed use, rate limits, retention, and `do_not_enrich` enforcement.
- Move profiles to normalized module-owned tables when query volume, field-level purge, or analytics require it.

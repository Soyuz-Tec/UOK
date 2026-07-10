# Contacts App Plan

**Module:** `contacts.core`

**Target candidate:** `UOK-3.1.0-alpha.3`

**Status:** Active alpha module plan. Current implementation is a working Contacts CRM slice with module-owned backend behavior, module-owned tests, manifest-declared runtime surfaces, and a React workspace composed through the UOK frontend shell.

**Source root:** `modules/contacts.core`

## Purpose

`contacts.core` is the first optional UOK capability module. It provides reusable party, person, organization, note, relationship, group, review, duplicate-resolution, CSV import, and derived contact intelligence capabilities.

The module must stay independently developable, installable, upgradable, disableable, uninstallable, maintainable, and portable without compromising the UOK runtime kernel. Contacts behavior belongs in `modules/contacts.core`; `src/uok` may expose compatibility facades and shared runtime services only.

## Current Ownership

| Surface | Current owner |
|---|---|
| Manifest and lifecycle contract | `modules/contacts.core/manifest.yaml` |
| Backend implementation | `modules/contacts.core/backend/uok_contacts_core` |
| Module migrations | `modules/contacts.core/migrations` |
| Module tests and verifier | `modules/contacts.core/tests` |
| Current executable UI | `web/src/features/contacts` |
| UI ownership marker | `modules/contacts.core/web` |
| Frontend composition | `web/src/features/modules/moduleSurfaceRegistry.tsx` |

The current frontend is still compiled as part of the shared UOK React shell. A future packaging step may move more executable Contacts UI source under `modules/contacts.core/web`, but that must preserve React + TypeScript, generated API contracts, shared primitives, and the module surface registry.

## Manifest Contract

The module currently declares these runtime surfaces:

- API router: `uok_contacts_core.api:router`
- command handlers: `uok_contacts_core.commands:command_handlers`
- command permissions: `uok_contacts_core.commands:command_permissions`
- role grants: `uok_contacts_core.policy:role_grants`
- dashboard provider: `uok_contacts_core.reports:dashboard_counts`
- evidence provider: `uok_contacts_core.reports:evidence`
- model exports: `uok_contacts_core.models:owned_models`
- candidate verifier: `modules/contacts.core/tests/verify/UokCandidateContacts.ps1`

The command bus must discover Contacts commands through the manifest provider. Contacts permission atoms must not be hardcoded in `src/uok/security.py`.

## Implemented Capability Baseline

The alpha.3 baseline currently includes:

- install, upgrade, disable, enable, and uninstall lifecycle behavior;
- party records for people and organizations;
- create, update, archive, restore, admin purge, and read workflows;
- role-aware read/write permissions;
- ownership, visibility, and team-ready metadata;
- private notes and unified activity timeline signals;
- party relationships with editable and removable links;
- persistent manual contact groups;
- business-domain group generation from eligible business email domains;
- smart-rule group generation by company, country, type, review state, and source;
- CSV import batches with review-first imported records;
- review queue and quality views;
- duplicate detection, merge, and rollback;
- derived business intelligence profiles;
- shared contact signal helpers so quality, readiness, and profile derivation count facts consistently;
- PostgreSQL-native search with Python fallback for compatibility paths;
- List + Detail, Table, and Cards views;
- saved search presets and user-saved searches;
- shared resizable table column behavior;
- shared user-configurable table column visibility for optional contact data points;
- shared user-configurable List + Detail display-field visibility for compact identity lanes;
- a shared contact field registry so List + Detail and Table views reuse the same field labels and value extraction;
- one toolbar-level `Fields` menu that controls visible contact fields for the active view instead of separate `Columns` and `Display fields` menus in different locations;
- local candidate verifier coverage.

## Domain Model

### Party

`Party` is the shared Contacts entity for people and organizations.

Required fields and concepts:

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
- timestamps for create, update, archive, and purge

### Contact Facts

The alpha.3 release exposes typed API fields for email, phone, website, address, birthday, important date, instant message, tags, consent status, allowed use, confidence level, title, and note-backed context. Contacts normalizes valid phone numbers to E.164 at the module command boundary while preserving bounded non-normalizable alpha, placeholder, or imported values for review.

For alpha.3, many repeated or optional contact facts may remain in module-owned JSON attributes if the API and UI expose stable typed fields. Future releases should split repeated values into dedicated tables when multiple values, consent history, validation, sync, or dedupe require stronger relational behavior.

### Relationships

Relationships connect two parties with explicit labels. Supported labels include:

- `works_for`
- `primary_contact`
- `billing_contact`
- `decision_maker`
- `finance_contact`
- `operations_contact`
- `advisor`
- `supplier`
- `supplier_contact`
- `customer`

Relationship rows must show the related party name, type, and available email. Users must be able to edit the relationship type and unlink the relationship without leaving the workspace.

### Notes And Activity

Notes are private internal timeline entries, separate from editable party facts.

The Activity pane should answer why the contact exists. It should combine:

- import/source context;
- human notes;
- relationship links;
- group membership signals;
- duplicate candidates;
- duplicate merge history.

Create, update, archive, restore, purge, note, relationship, group, import, merge, and rollback commands must emit actor-stamped events.

### Groups

Groups are persistent contact working sets owned by `contacts.core`.

Group rules:

- Groups do not replace relationships.
- Groups do not duplicate contact facts.
- Manual, business-domain, and smart-rule groups are normal `ContactGroup` records.
- Group membership is stored through `ContactGroupMember`.
- Group membership is many-to-many: one contact can belong to multiple groups, and one group can contain multiple contacts. The same contact must not be duplicated inside the same group.
- Group schema changes stay under `modules/contacts.core/migrations`.

Business-domain groups are generated from eligible business email domains. Their stable identity is the email domain, but their display name should prefer the best company signal: linked organization first, organization record second, readable domain fallback last. Personal, free-mail, test, and demo domains must be excluded.

Smart-rule groups are generated from existing facts. Alpha.3 rules are company, country, contact type, review state, and source. Company grouping should use linked organization relationships before inline organization fields.

### Import Batches

CSV import creates an import batch and row-level results. Imported rows should enter `needs_review`, `possible_duplicate`, or `incomplete` states when trust is not high enough for normal use.

Automated marketing contacts should be rejected or quarantined before they pollute normal contact records.

### Duplicate Merge

Duplicate merge is a recoverable Contacts command, not a destructive delete.

The selected primary party remains authoritative. The duplicate is archived and annotated with merge metadata. Missing facts may be filled from the duplicate; explicit user field choices override the default. Notes, group memberships, and relationships move to the primary party.

Each merge stores a rollback snapshot in module-owned attributes. `RollbackDuplicateMerge` restores the archived duplicate, moves owned evidence back where possible, marks the snapshot as rolled back, and emits recovery evidence.

## API Scope

Current alpha.3 API scope:

- list/search parties;
- read party detail;
- create/update/archive/restore/purge party;
- list/add notes;
- list/link/update/remove relationships;
- list/create/update/archive groups;
- add/remove contacts from groups;
- filter parties by group;
- generate business-domain groups;
- generate smart-rule groups;
- import CSV rows;
- list review queue;
- read module readiness/evidence.

Public contracts must remain OpenAPI-compatible and reflected in the generated TypeScript client.

## UI Scope

The Contacts workspace must stay clean, low-distraction, and aligned with the UOK UI policy and Contacts workspace minimal design plan.

Current UI responsibilities:

- support List + Detail, Table, and Cards views;
- persist the user's last selected view;
- keep search always available;
- unify filters, saved searches, sort, and sectioning into one search surface;
- use `Group` only for persistent contact groups;
- use `Section by` for result sectioning;
- keep the group rail secondary and compact;
- keep group destructive actions visually quiet until hover, focus, or narrow/touch layouts require explicit access;
- support group creation, selection, archive, business-domain grouping, and smart grouping;
- support add/remove group membership from contact detail;
- support editable/removable relationship rows;
- use a global workspace popup primitive for table/cards detail editing;
- keep New Contact clean and independent from any previously selected contact;
- keep table review workflows compact, with explicit row-level open-detail affordances in addition to row click and keyboard activation;
- let users add or remove optional Table view data points without changing the default low-distraction view;
- let users choose the compact List + Detail secondary display fields while keeping the contact name as the fixed primary identity;
- expose active-view field visibility through one consistent toolbar-level `Fields` control; avoid duplicate user-facing names such as `Columns` and `Display fields` for the same visibility workflow;
- use shared record-detail primitives for profile headers, fact rows, and tags so detail surfaces stay consistent, reusable, and print-ready;
- keep contact detail profile pages print-friendly by preserving semantic facts and labels while hiding interactive controls in print media;
- separate user-managed groups from generated system labels in contact detail so users can manage working groups without confusing them with derived metadata;
- keep create/edit forms progressive, with essentials first and optional addable sections;
- keep validation messages specific and near the affected fields;
- support light, dark, and system appearance through design tokens.

The three views have distinct purposes:

- List + Detail: default low-distraction contact workspace.
- Table: dense review and correction workflow with resizable columns.
- Cards: recognition-focused browsing.

List + Detail rows must stay selection-focused. They show the contact name and, only when useful, a compact identity cue such as linked/inline organization or title. On desktop, the compact identity cue belongs in a secondary aligned row column with a lightweight sticky `Organization` header rather than directly below the name. They must not force generic `Person` or `Organization` subtitles, and they must not repeat email, phone, website, address, or other full contact facts that already belong in the detail inspector. Table view remains the comparison surface for contact-fact columns, and Cards view remains the richer preview surface.

## Permission Scope

Initial permission behavior:

- `platform_admin`: full module and record management, restore, purge, reassignment.
- `ops_manager`: create, edit, archive, restore permitted records, import CSV, manage notes, manage relationships, and manage groups.
- `viewer`, `trader`, `finance_manager`: read permitted records.

Ownership and team fields must remain in the data/API shape even while full team enforcement matures.

## Search And Review Scope

Search is layered:

- default simple search for normal users;
- saved views for common workflows;
- filters for status, review, type, source, quality, and group;
- sort and direction controls;
- result sectioning;
- PostgreSQL-native text search in the PostgreSQL runtime;
- Python fallback for SQLite tests and local compatibility paths.

Review workflows should guide users rather than expose raw technical state. The quality workspace should surface:

- possible duplicates;
- email-only records;
- placeholder names;
- missing company context;
- missing purpose notes;
- imported review records;
- incomplete records;
- ready records.

## Evidence And Dashboard Scope

Contacts dashboard and baseline evidence are module-owned providers:

- `uok_contacts_core.reports:dashboard_counts`
- `uok_contacts_core.reports:evidence`

Evidence must prove:

- module lifecycle works;
- command permissions work;
- contact CRUD works;
- note, relationship, group, import, duplicate, and review workflows work;
- group tables and memberships exist;
- group-filtered contacts can be read through the API;
- candidate verifier scenario passes.

## Current Verification

Before accepting Contacts work, run the relevant narrow test and then the broader UOK gate before publication:

```powershell
python -m compileall -q src modules tests conftest.py
python -m pytest modules/contacts.core/tests -q
npm --prefix web test
npm --prefix web run build:static
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```

For quality and source-size work:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action EngineeringEvidence
```

Browser verification must confirm:

- title and primary shell labels use `UOK`;
- Contacts exposes List + Detail, Table, and Cards;
- groups can be selected, created, generated, archived, and used to filter records;
- contact detail supports group and relationship operations without leaving the workspace;
- Review Queue and quality workflows are understandable;
- no product-specific labels appear;
- no console errors appear.

## Next Backlog

Near-term development should prioritize:

1. Improve guided review/import/duplicate workflows so each queue has clear next actions.
2. Add richer contact fact handling for multiple emails, phones, addresses, URLs, and labels.
3. Add stronger privacy and consent workflows around allowed use, source, confidence, and audit history.
4. Improve group management with rename, description edit, membership review, and clearer generated/manual distinction.
5. Add contact activity filtering and clearer source provenance.
6. Add optional vCard import/export under explicit permission rules.
7. Expand team/ownership enforcement beyond the current metadata foundation.
8. Move more executable Contacts UI source toward module-root packaging when the frontend composition model supports it.
9. Keep module migrations under `modules/contacts.core/migrations` and avoid expanding the shared baseline for Contacts-only changes.

## Non-Goals For Alpha.3

- Full offline sync.
- Bulk export for normal users.
- External address book synchronization.
- Runtime-loaded frontend modules from YAML.
- Product-specific CRM, cargo, accounting, or industry workflows.
- Replacing UOK shared auth, command bus, or module lifecycle behavior.

## Source Basis

This plan is based on:

- UOK architecture: `docs/ARCHITECTURE.md`
- UOK module extension contract: `docs/architecture/UOK_MODULE_EXTENSION_CONTRACT.md`
- UOK UI design policy: `docs/design/UOK_UI_DESIGN_POLICY.md`
- Contacts workspace design phases: `docs/design/UOK_CONTACTS_WORKSPACE_MINIMAL_PHASES.md`
- Contacts business intelligence profile guidance: `docs/architecture/UOK_CONTACT_BUSINESS_INTELLIGENCE_PROFILES.md`
- Apple Contacts documentation: https://developer.apple.com/documentation/contacts
- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/
- Apple layout guidance: https://developer.apple.com/design/human-interface-guidelines/layout-and-organization
- Apple lists and tables guidance: https://developer.apple.com/design/human-interface-guidelines/lists-and-tables
- Apple split views guidance: https://developer.apple.com/design/human-interface-guidelines/split-views

# Contacts App Plan

**Module:** `contacts.core`

**Target:** `UOK-3.1.0-alpha.3`

**Status:** Alpha.3 in progress; module extension ownership and Contacts packaging hardening are active.

**Source root:** `modules/contacts.core`

## Purpose

`contacts.core` is the first independently developable UOK application module. It must remain installable, upgradable, disableable, uninstallable, maintainable, and portable without compromising UOK. Its backend implementation lives under `modules/contacts.core/backend/uok_contacts_core`; the `src/uok/contact*.py` files are compatibility facades for stable kernel imports.

The alpha.3 module-extension baseline declares Contacts runtime surfaces in `modules/contacts.core/manifest.yaml`:

- API router;
- command handlers;
- command permissions;
- role grants;
- dashboard count provider;
- baseline evidence provider;
- model/table exports;
- candidate verifier scenario under `modules/contacts.core/tests/verify`.

The first release builds a Contacts Full CRM Slice that starts with practical CRM work and leaves a clear path toward Enterprise MDM.

## Source Basis

This plan is based on UOK module policy, UOK UI policy, and these Apple references:

- Contacts business intelligence profiles: `docs/architecture/UOK_CONTACT_BUSINESS_INTELLIGENCE_PROFILES.md`
- Apple Contacts documentation: https://developer.apple.com/documentation/contacts
- Apple Contacts access workflow: https://developer.apple.com/videos/play/wwdc2024/10121/
- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/
- Apple layout guidance: https://developer.apple.com/design/human-interface-guidelines/layout-and-organization
- Apple lists and tables guidance: https://developer.apple.com/design/human-interface-guidelines/lists-and-tables
- Apple split views guidance: https://developer.apple.com/design/human-interface-guidelines/split-views

## User Decisions

- Start with CRM Core and evolve gradually toward Enterprise MDM.
- Use a party model for people and organizations.
- Support List + Detail, Table Workspace, and Card Directory because different users need different working styles.
- Remember the user's last selected Contacts view; fall back to List + Detail.
- Prioritize fast record work: search, create, edit, save, archive, restore, and quick switching.
- Require at least one meaningful field before saving a party.
- Warn but allow possible duplicates, especially for future offline/mobile workflows.
- Prepare for offline but do not build full offline sync in alpha.3.
- Use mixed permissions: role foundation, ownership, and team-ready fields.
- User delete means archive; admin can restore or purge.
- Notes are private internal timeline entries.
- Search is layered: simple default search plus filters for power users.
- Contacts can be organized into user-managed groups without changing the core party model.
- Contacts can be grouped automatically by business email domain; group names should prefer the related company label, while personal/free-mail and test/demo domains are excluded so the group rail remains useful.
- Contacts can be grouped automatically by smart rules for company, country, contact type, review state, and source. These smart-rule outputs are materialized as normal contact groups so users can select, archive, and adjust them through the same group workflow.
- Users can import CSV and correct records; normal users cannot bulk export.
- Imported, incomplete, uncertain, email-only, missing-company, and possible duplicate records appear in a review queue.
- Possible duplicates can be compared and merged from the guided quality workflow. The merge keeps one selected authoritative party, fills missing facts from the duplicate, moves notes, group memberships, and relationships, archives the duplicate for recovery/audit, and emits module-owned merge evidence.

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
- `finance_contact`
- `operations_contact`
- `advisor`
- `supplier`
- `supplier_contact`
- `customer`

### Notes

Notes are private internal timeline entries, stored separately from the editable party profile and included in audit/event evidence.

The Activity pane must present a unified contact timeline rather than a raw note list. It should answer "why does this contact exist?" with source/import context, purpose notes, relationship links, group membership, duplicate candidates, and duplicate merge history while keeping the note composer available for human cleanup work.

### Groups

Groups are user-managed contact lists owned by `contacts.core`.

Required concepts:

- `ContactGroup`: name, optional description, kind, visibility scope, owner, team-ready field, status, and timestamps.
- `ContactGroupMember`: many-to-many membership between a group and a party.
- Groups must not duplicate contact facts or replace relationships. A group answers "which contacts belong in this working set"; a relationship answers "how two parties are connected."
- Business-domain groups are generated from contact email domains as repeatable `business_domain` groups. Their identity is the email domain, but their display name should come from the best related company signal: linked organization relationships first, then organization records, then a readable domain fallback. They remain normal group records after creation and can be selected, archived, and used to filter contacts.
- Smart-rule groups are generated from existing contact facts as repeatable `smart_rule` groups. Supported alpha.3 rules are company, country, contact type, review state, and source. Company smart groups use linked organization relationships before falling back to inline organization fields; generated groups remain normal materialized groups rather than hidden dynamic filters.
- Group schema changes stay in `modules/contacts.core/migrations`; they must not expand the shared UOK baseline.

### Import Batches

CSV import creates an import batch and records per-row results. Imported rows may create parties in `needs_review`, `possible_duplicate`, or `incomplete` review states.

### Duplicate Merge

Duplicate merge is a Contacts command, not a destructive delete. It archives the duplicate and records `merged_into_party_id` in module-owned attributes so administrators can audit or recover the original record.

The merge workflow supports explicit field choices for contact facts such as email, phone, website, address, organization, role, first name, and last name. If no choice is supplied, the command keeps the selected primary value and fills only missing facts from the duplicate. If a user chooses the duplicate value for a fact, the command records that choice in `merge_history` before changing the primary record.

Each successful merge stores a rollback snapshot under the surviving contact's module-owned attributes. The snapshot includes previous contact facts, duplicate status/review state, moved notes, moved group memberships, and moved relationships. `RollbackDuplicateMerge` uses that snapshot to restore the archived duplicate, move owned evidence back where possible, mark the snapshot as rolled back, and emit `ContactDuplicateMergeRolledBack`. This is an admin recovery operation, not normal user delete.

## API Scope

Required endpoints for alpha.3:

- List/search parties.
- Read party detail.
- Create party.
- Update party.
- Archive party.
- Restore party.
- Purge party, admin only.
- List/add notes.
- List/add relationships.
- List/create/update/archive groups.
- Add/remove contacts from groups.
- Filter parties by group.
- Import CSV rows.
- List review queue.
- Read module readiness/evidence.

All public API contracts must be OpenAPI-compatible and reflected in the generated TypeScript client.

The command bus must discover Contacts commands through the manifest `command_handlers` provider instead of importing Contacts handlers directly into `src/uok/commands.py`.

## UI Scope

The Contacts UI must be human-friendly and policy-aligned:

- View switcher: List + Detail, Table, Cards.
- Last selected view persists per browser.
- Search box is always available.
- Filters are available without overwhelming simple users.
- The unified search surface includes a `Group` filter for persistent contact groups.
- Visual result sectioning uses `Section by`, not `Group`, to avoid confusing it with persistent contact groups.
- A compact Contacts group rail supports all contacts, saved groups, group creation, and archive actions.
- The group rail includes a repeatable business-domain action that creates or updates persistent groups from eligible contact email domains without duplicating memberships; reruns may improve generated group names as better company relationships are added.
- The group rail includes a compact smart-groups action that generates persistent groups from company, country, contact type, review state, and source without duplicating memberships.
- Contact detail shows current group memberships and supports add/remove without leaving the workspace.
- List + Detail is the fallback default.
- Table supports dense review and correction with persisted, accessible resizable columns from the shared UOK table primitive.
- Cards support recognition-focused browsing.
- The quality workspace must separate possible duplicates, email-only records, placeholder names, missing company context, missing purpose notes, imported review records, incomplete records, and ready records into guided queues with direct suggested actions.
- Review Queue is visible and actionable.
- Review Queue includes duplicate comparison and merge actions that let users choose which record remains authoritative without leaving the workspace.
- Create/edit form supports minimal save with at least one meaningful field.
- Validation errors are specific and close to the affected fields.
- Module disabled/uninstalled states are clear and route users back to Apps Manager actions.
- Light, dark, and system appearances remain supported.

Current UI source remains in `web/src/features/contacts` and is composed through `web/src/features/modules/moduleSurfaceRegistry.tsx`. The module root `modules/contacts.core/web` remains the ownership marker until a future packaging step moves executable module UI behind the module root.

## Permission Scope

Initial permission behavior:

- `platform_admin`: full module and record management, restore, purge, reassignment.
- `ops_manager`: create, edit, archive, restore permitted records, import CSV, manage notes and relationships.
- `viewer`, `trader`, `finance_manager`: read permitted records.

Ownership and team fields must exist in the data/API shape even if full team enforcement matures later.

Role grants are declared by `uok_contacts_core.policy:role_grants` and merged into kernel permissions at authorization time. Contacts permission atoms must not be hardcoded in `src/uok/security.py`.

## Evidence And Dashboard Scope

Contacts dashboard counts and baseline evidence checks are module-owned providers:

- `uok_contacts_core.reports:dashboard_counts`
- `uok_contacts_core.reports:evidence`

The kernel owns the stable `/api/dashboard` and `/api/baseline-evidence` response shapes, while Contacts owns its module-specific fragments.

Group evidence must prove that group tables exist, group membership exists, group commands emit events, and group-filtered contacts can be read through the Contacts API.

## Acceptance Gates

Before packaging `UOK-3.1.0-alpha.3`:

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
- Contacts groups can be selected, created, and used to filter records
- Review Queue appears
- CSV import UI appears
- no retired UOK names appear
- no product-specific labels appear
- no console errors appear

## Remaining Packaging Work

- Move more Contacts React source under `modules/contacts.core/web` when the frontend build can preserve shared shell composition.
- Continue moving executable Contacts UI source toward module-root packaging when shared shell composition can preserve the same React + TypeScript build.
- Keep future Contacts schema migrations under `modules/contacts.core/migrations` instead of expanding the shared initial baseline.

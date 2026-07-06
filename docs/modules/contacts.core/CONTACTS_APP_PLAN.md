# Contacts App Plan

**Module:** `contacts.core`

**Target:** `UOK-3.1.0-alpha.2`

**Status:** Approved for implementation

**Source root:** `modules/contacts.core`

## Purpose

`contacts.core` is the first independently developable UOK application module. It must remain installable, upgradable, disableable, uninstallable, maintainable, and portable without compromising UOK. Its backend implementation lives under `modules/contacts.core/backend/uok_contacts_core`; the `src/uok/contact*.py` files are compatibility facades for stable kernel imports.

The first release builds a Contacts Full CRM Slice that starts with practical CRM work and leaves a clear path toward Enterprise MDM.

## Source Basis

This plan is based on UOK module policy, UOK UI policy, and these Apple references:

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
- Prepare for offline but do not build full offline sync in alpha.2.
- Use mixed permissions: role foundation, ownership, and team-ready fields.
- User delete means archive; admin can restore or purge.
- Notes are private internal timeline entries.
- Search is layered: simple default search plus filters for power users.
- Users can import CSV and correct records; normal users cannot bulk export.
- Imported, incomplete, uncertain, and possible duplicate records appear in a review queue.

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

All public API contracts must be OpenAPI-compatible and reflected in the generated TypeScript client.

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

## Permission Scope

Initial permission behavior:

- `platform_admin`: full module and record management, restore, purge, reassignment.
- `ops_manager`: create, edit, archive, restore permitted records, import CSV, manage notes and relationships.
- `viewer`, `trader`, `finance_manager`: read permitted records.

Ownership and team fields must exist in the data/API shape even if full team enforcement matures later.

## Acceptance Gates

Before packaging `UOK-3.1.0-alpha.2`:

```powershell
python -m compileall -q src
python -m pytest -q
cd .\web; npm run test; npm run build:static; cd ..
powershell -ExecutionPolicy Bypass -File .\scripts\verify_uok_candidate.ps1
```

Browser verification must confirm:

- title and main heading use `UOK`
- Contacts app exposes the three views
- Review Queue appears
- CSV import UI appears
- no retired UOK names appear
- no product-specific labels appear
- no console errors appear

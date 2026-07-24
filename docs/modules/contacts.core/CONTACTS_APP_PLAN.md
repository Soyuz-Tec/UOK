# Contacts Core Implementation Plan

**Module:** `contacts.core`

**Target candidate:** `UOK-3.1.0-alpha.3`

**Status:** Active implementation and qualification plan. The 5 Groups Manager slices and 7 Contacts system slices are implemented in the current branch; production qualification is tracked separately and must be evidenced before promotion.

**Source root:** `modules/contacts.core`

## Purpose And Authority

`contacts.core` is UOK's optional, governed Party and Contacts system of record. It owns people, organizations, first-class contact facts, consent evidence, Contacts-specific team membership, relationships, groups, contact quality state, durable import evidence, duplicate candidates, saved views, contact activity, provider-neutral external identities, and custom-field definitions/values.

The module does not own messages, meetings, tasks, opportunities, or other engagement records. Calendar, Communications, Planning, and future CRM capabilities retain their own records and expose only actor-authorized references or summaries through typed boundaries.

The accepted architecture decision is `docs/architecture/ADR-0027-contacts-system-of-record-governance-and-interoperability.md`.

## Current Ownership

| Surface | Owner |
|---|---|
| Manifest/lifecycle contract | `modules/contacts.core/manifest.yaml` |
| Backend, commands, API, access policy, ORM | `modules/contacts.core/backend/uok_contacts_core` |
| Schema changes | `modules/contacts.core/migrations` |
| Backend behavior tests | `modules/contacts.core/tests` |
| Candidate verifier/evidence | `modules/contacts.core/verify` |
| Production React/CSS | `modules/contacts.core/web/src` |
| Frontend tests | `modules/contacts.core/tests/web` |
| Compile-time shell composition | validated manifest plus generated module-surface catalog |

Contacts commands and permission atoms are discovered through the validated manifest. Product-specific Contacts behavior must not move into `src/uok` or the shared shell.

## Modernization Implementation Ledger

"Implemented" means source, contracts, and focused tests for the slice are present. It does not mean all release gates have passed in every target environment.

### Groups Manager: 5 slices

| Slice | Implemented behavior | Primary evidence |
|---|---|---|
| 1. Persistent manual group lifecycle | Create, edit name/description, user-facing recoverable Delete through archive, restore, idempotent events | `group_commands.py`, `test_contacts_groups.py` |
| 2. Safe contact membership lifecycle | Authorized add/remove, duplicate prevention, visible counts | `group_membership_commands.py`, `test_contacts_groups.py` |
| 3. Governed smart/domain generation and exact reconciliation | Generated groups reject direct mutation, exactly reconcile active members, retire stale generated groups | `group_domain_*`, `group_smart_*`, domain/smart group tests |
| 4. Aggregate/filter performance plus stale/empty hygiene | Bounded aggregate reads; manual/generated, empty, and archived filters; exact-evidence verifier cleanup | `group_read_model.py`, group tests, `scripts/uok_contacts_cleanup_ops.ps1` |
| 5. Draggable capability-aware Groups Manager | Shared draggable popup, focus restoration, manual/generated governance, read-only capability behavior, localization/RTL | `ContactGroupsManager*`, `ContactsWorkspace.groupManager.test.tsx` |

### Contacts System: 7 slices

| Slice | Implemented behavior | Primary evidence |
|---|---|---|
| 1. First-class facts | Multi-valued labelled facts, normalization, primary synchronization, source/confidence/verification provenance | `system_models.py`, `system_commands.py`, `test_contacts_system_of_record.py` |
| 2. Privacy/consent/team authorization | Fail-closed team reads, recoverable reasoned team Delete/Restore with preserved membership, append-only consent evidence, restricted export, anonymizing purge | `access.py`, `system_lifecycle.py`, `privacy_commands.py`, lifecycle/security tests |
| 3. Guided import/export/bulk | CSV/vCard preview, explicit execution, durable row outcomes, bulk commands and batch evidence | `guided_import.py`, `contact_exchange.py`, system commands/tests |
| 4. Global quality/dedupe/rollback | Persisted duplicate candidates, normalized blocking, resolution state, merge/import recovery | duplicate modules, system read model, focused tests |
| 5. Saved views plus global relationship productivity | Actor-scoped saved views and actor-authorized relationship lookup | `system_commands.py`, `system_read_model.py`, focused tests |
| 6. Genuine activity plus truthful interoperability boundary | Server-backed activity, vCard exchange, provider-neutral external identities; no false live-provider claim | command support, exchange/system modules, focused tests |
| 7. Custom-field extensibility plus production qualification | Governed definitions/values plus recoverable definition Delete/Restore are implemented; archived definitions leave active editing while stored values remain recoverable; full release proof remains an explicit gate | system models/commands/lifecycle, migration 003, lifecycle tests, qualification checklist below |

## Data And Integrity Rules

- `Party` is the canonical person/organization identity. User-facing Delete invokes recoverable archive; purge remains a distinct privileged operation that irreversibly anonymizes contact-owned PII while retaining a non-PII tombstone and platform audit evidence.
- `PartyFact` is the authoritative multi-valued contact-fact model. A primary compatible fact updates the legacy flat projection during migration.
- Consent is append-only evidence by purpose and channel. Prior evidence is not overwritten. Export excludes a contact for an `any` or unmappable denial and redacts channel-specific email, phone/SMS, or postal facts.
- Contacts team access fails closed. A team-scoped record is visible only to an active team member, its owner, or an actor with explicit organization-wide Contacts authority. Deleting a user-created team archives it and preserves membership; archived teams reject edits until Restore.
- Manual groups are user-managed. Business-domain and smart-rule groups are generated read models whose membership is reconciled exactly by their generator.
- Duplicate candidates are persisted and scored; list reads must not run repeated quadratic comparisons.
- Import preview does not write contacts. Execution records durable row outcomes and a rollback boundary; rollback applies rows in reverse order and refuses to overwrite intervening edits.
- Custom-field definitions and values stay organization-scoped and Contacts-owned. Definition Delete archives the definition, hides it from active value reads/editors, and preserves its values for the same-definition Restore.
- Team and custom-field lifecycle reads return server-computed `can_delete`, `can_restore`, revision, and strong ETag facts. Delete requires a reason and both Delete and Restore require `If-Match`; a stale ETag returns structured `412` recovery guidance and requires a fresh human confirmation.
- Relationships cannot self-link and duplicate typed links are rejected by module-owned constraints.

Migration `003_contacts_core_system_of_record.sql` adds the governed tables and indexes without dropping the compatibility projection. See `modules/contacts.core/migrations/README.md` for rollout and rollback.

## API And Command Scope

The module exposes actor-authorized reads for parties, groups, facts, consent history, teams, imports, duplicates, saved views, activity, relationships, external identities, and custom fields. Writes use the audited UOK command bus for:

- party create/update/archive/restore/purge;
- manual group create/update/recoverable Delete through archive/restore and membership changes;
- governed domain/smart generation;
- fact save/remove and consent recording;
- team create/update, reasoned recoverable Delete/Restore, and membership;
- CSV/vCard import preview/execution and import rollback;
- duplicate refresh/resolution, merge, and rollback;
- saved-view save/delete;
- bulk update/export policy enforcement;
- external-identity links, custom-field definition/value changes, and reasoned recoverable definition Delete/Restore.

Public contracts must remain OpenAPI-compatible and generated TypeScript artifacts must match the rendered API.

## Permission And Privacy Scope

The manifest separates routine read/manage permissions from restore, purge, import, bulk, consent, customization, dedupe, export, sync, and team administration. Every endpoint and command must enforce organization isolation and actor visibility; UI capability hiding is not an authorization control.

Bulk and export paths must honor consent and explicit permissions. Purge must remove contact-owned PII from facts, notes, relationships, memberships, consent details, custom values, external identities, and unresolved import/duplicate references while redacting affected command/event payloads.

## Workspace Scope

Contacts uses the shared minimal workspace command surface for search, paging, view selection, fields, and New Contact. List + Detail, Table, and Cards keep distinct purposes. Search options own filters, saved views, sort, and sectioning.

The Groups Manager replaces the redundant persistent rail. It is a shared draggable popup with:

- manual/generated/empty/archived filters;
- create, edit, confirmed recoverable Delete, restore, and membership operations for authorized users;
- Delete is available only for active manual groups with management capability; generated groups remain generator-owned and archived groups expose Restore instead;
- deleting a manual group preserves its memberships and audit history under Archived, and deleting a contact preserves its recoverable record while permanent Purge remains visibly distinct;
- a clear explanation that generated groups are reconciled by UOK;
- read-only rendering when the actor lacks management capability;
- focus restoration, keyboard operation, touch targets, localization/RTL, and narrow-layout behavior.

Contacts data tools expose facts, privacy/consent, team assignment, guided import/export/bulk, quality/dedupe/rollback, saved views/activity/relationships, interoperability state, and custom fields without claiming unavailable providers. User-created teams and custom-field definitions expose consistent Delete and Restore controls driven by server eligibility; Delete uses the shared draggable confirmation, requires a reason, keeps stale confirmations open after reloading current state, and restores focus to a surviving record control.

## Interoperability Boundary

vCard is the implemented exchange format. External identities, cursors, and conflict state form a provider-neutral adapter boundary. Google, Microsoft, CardDAV, or other two-way synchronization remains unavailable until a separate adapter provides credentials, tenant consent, deletion semantics, rate-limit/retry handling, conflict policy, observability, and qualification evidence. The UI must distinguish supported format, configured adapter, and successful synchronization.

## Operations And Hygiene

New candidate verifier runs remove temporary membership and archive their
temporary group to prove lifecycle behavior, but that recoverable Archive is
not data-neutral cleanup. Full qualification uses
`scripts/verify_uok_candidate_isolated.ps1` and requires exact labelled
container, volume, and network absence after each pass. Historical empty
verifier groups can be identified only through the dry-run-first
`ContactsVerifierGroupCleanup` operation. It requires exact name/description,
command-log, event, API visibility, and zero-member evidence; execution
requires a reviewed plan, an existing backup, and two explicit switches. It
archives and never deletes.

See `docs/operations/UOK_CONTACTS_CORE_OPERATIONS.md`.

## Qualification Checklist

Before promotion, record the exact result or explicit skip reason for:

```powershell
python -m compileall -q src modules tests conftest.py
python -m pytest modules/contacts.core/tests -q
python -m pytest tests/test_module_model_registry.py tests/test_module_physical_boundaries.py -q
npm --prefix web test
npm --prefix web run check:contracts
npm --prefix web run build:static
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```

For runtime/UI changes, rebuild the PostgreSQL candidate and verify authenticated browser/API behavior, console cleanliness, keyboard/focus, 320 px, 200% text, light/dark/system appearance, RTL, touch targets, module lifecycle, isolated candidate-state destruction, backup, and rollback. Source presence alone is not production proof.

## Residual Backlog

1. Implement and qualify individual provider adapters only when real credentials and provider policies are available.
2. Add production-environment load, recovery, retention, and observability evidence before any production-ready claim.
3. Keep the neutral module-surface host port narrow and the shell/Contacts
   cycle enforcement green as new Contacts workflows are added.
4. Continue additive module-owned migrations and remove the legacy primary projection only through a separately accepted migration decision.

## Non-Goals

- Owning engagement records from Calendar, Communications, Planning, or CRM modules.
- Runtime-loading React code from manifest YAML.
- Unconsented bulk export or implicit marketing activation.
- Destructive deletion of verifier groups or governance/audit evidence.
- Claiming live address-book synchronization from a vCard formatter or provider-neutral identity record.

## Source Basis

- `docs/ARCHITECTURE.md`
- `docs/architecture/ADR-0027-contacts-system-of-record-governance-and-interoperability.md`
- `docs/architecture/UOK_MODULE_EXTENSION_CONTRACT.md`
- `docs/design/UOK_UI_DESIGN_POLICY.md`
- `docs/design/UOK_CONTACTS_WORKSPACE_MINIMAL_PHASES.md`
- `docs/operations/UOK_CONTACTS_CORE_OPERATIONS.md`
- `modules/contacts.core/manifest.yaml`
- `modules/contacts.core/migrations/README.md`
- `modules/contacts.core/verify/README.md`

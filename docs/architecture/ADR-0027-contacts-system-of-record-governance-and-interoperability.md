# ADR-0027: Contacts System Of Record, Governance, And Interoperability

**Status:** Accepted

**Date:** 2026-07-24

**Lifecycle note:** This is a historical umbrella decision. New material
changes to its independent privacy, authorization, data, or integration
concerns require focused ADRs.

## Context

`contacts.core` already owns reusable person and organization records, notes, relationships, groups, imports, duplicate merging, and review signals. Its alpha storage model keeps most contact facts and governance state in one JSON document. That shape cannot safely support multiple labelled values, field provenance, authoritative consent history, indexed duplicate discovery, durable import review, or provider synchronization.

The existing `team_id` fields are metadata only. Treating them as authorization without a membership authority would expose records to the wrong users. UOK also needs an explicit boundary between a governed contact directory and engagement data owned by Calendar, Communications, Planning, or a future CRM capability.

## Decision

1. `contacts.core` is the governed contact system of record. It owns party identity, contact facts, contact-specific teams, consent evidence, quality review, import/export evidence, saved contact views, duplicate candidates, and external contact identities. It does not become the owner of messages, meetings, tasks, opportunities, or other engagement records.
2. Multi-valued facts use first-class module-owned records. Every fact has a type, label, normalized value, primary and verification flags, source, confidence, and actor/timestamp provenance. The legacy flat attributes remain a compatibility projection during migration; new writes keep their primary projection synchronized.
3. Consent is append-only evidence by purpose and channel. The latest applicable record informs contactability, but earlier evidence is never overwritten. Export and bulk operations require their own permissions and must not silently bypass consent policy. A denied or revoked `any` or unmappable channel excludes the record; email, phone/SMS, and postal restrictions redact the matching facts from CSV and vCard output.
4. Purge means irreversible anonymization of the contact record and removal of contact-owned PII, notes, relationships, memberships, facts, consent details, custom values, external identities, and unresolved duplicate/import references. A non-PII tombstone and platform audit events remain so operational and security evidence is not falsified.
5. Team visibility fails closed. `contacts.core` owns a contact-team membership authority for its records. A `team`-scoped party or group is readable only by an active team member, its owner, or an actor with an explicit organization-wide Contacts permission. Other modules must not infer access from Contacts teams; a future product-neutral collaboration module may replace this provider through a separately recorded migration.
6. Generated groups are governed read models. Their generators reconcile exact active membership and retire stale generated groups. Users may manage manual groups; they cannot directly mutate generated group definitions or membership.
7. Imports use preview/dry-run and explicit create-or-update execution, durable row outcomes, idempotency checksums, and batch rollback evidence. Import and duplicate-merge rollback use post-operation state fingerprints and fail closed when later edits make the rollback stale. Sensitive merge recovery snapshots remain internal audit evidence; public party attributes expose only non-sensitive merge identifiers and timestamps. Duplicate review uses normalized blocking keys and persisted, scored candidate state instead of repeated quadratic scans.
8. Saved views, contact activity, and global relationship lookup are server-backed and actor-scoped. Activity links to authorized records in other modules rather than copying their private payloads.
9. vCard import/export is the first interoperability format. Provider-neutral external identities, cursors, and conflict state establish the adapter boundary; Google, Microsoft, and CardDAV synchronization are not claimed until a provider adapter has its own credentials, deletion policy, rate-limit handling, and qualification evidence.
10. Governed custom-field definitions and values are module-owned. They extend Contacts without adding CRM-specific behavior to the kernel. User-facing Delete archives a definition and removes it from active value editing while preserving its stored values; Restore reactivates the same definition and values.
11. User-created Contacts teams use the same recoverable lifecycle. Delete archives the team without erasing membership or audit evidence, Restore reactivates it, and archived teams reject metadata and membership edits. Team and custom-field Delete/Restore require a current strong ETag; stale intent fails with a structured reload-and-reconfirm response. Delete also records a human reason.

## Implemented Modernization Slices

The current branch implements the accepted design in two reviewable groups. "Implemented" here means the module source, migrations, API/command contracts, UI, and focused tests are present; production qualification remains a separate release gate.

### Groups Manager (5 slices)

1. Persistent manual group lifecycle: create, rename/describe, archive, restore, and idempotent audit events.
2. Safe contact membership lifecycle: authorized add/remove behavior, duplicate protection, and visible membership counts.
3. Governed smart/domain generation and exact reconciliation: generated groups reject direct mutation, reconcile exact active membership, and retire stale generated groups.
4. Aggregate/filter performance plus stale/empty hygiene: bounded aggregate reads, kind/empty/archive filters, and recoverable cleanup of stale verifier artifacts.
5. Draggable, capability-aware Groups Manager: the shared popup replaces the redundant group rail, restores focus, explains generated governance, and supports read-only roles, localization, RTL, narrow layouts, and touch access.

### Contacts System (7 slices)

1. First-class facts with labels, normalized values, primary reconciliation, provenance, confidence, and verification state.
2. Privacy, consent, and team authorization with fail-closed visibility, append-only consent evidence, export restrictions, and anonymizing purge.
3. Guided import/export/bulk workflows with preview, explicit execution, durable row outcomes, and idempotent batch evidence.
4. Global quality, dedupe, and rollback with persisted duplicate candidates, normalized blocking keys, merge recovery, and import rollback.
5. Saved views and global relationship productivity with actor-scoped persistence and authorized relationship lookup.
6. Genuine activity plus a truthful interoperability boundary: server-backed activity, vCard exchange, and provider-neutral external identities without claiming an unimplemented live provider adapter.
7. Custom-field extensibility and production qualification: governed definitions/values are implemented; candidate, PostgreSQL, accessibility, browser, and operational proof remain required before promotion.

## Consequences

- The Contacts schema grows through additive module migrations and indexed, organization-scoped tables.
- Existing API fields continue to work while richer endpoints expose multiple facts and governance history.
- New permissions separate routine management from consent, ownership, bulk export, import, dedupe, purge, and team administration. Read models project record-qualified Delete/Restore eligibility; client role checks never grant lifecycle authority.
- Purge is intentionally destructive and must be explicit, audited, tested, and restricted.
- Legacy merge snapshots are sanitized in place by migration 004. Losing rollback for snapshots that existed only in public party attributes is an accepted privacy consequence; current merges keep private rollback evidence in the purge-scrubbed internal event ledger.
- PostgreSQL Contacts search indexes only an explicit public contact-field allowlist. Raw `attrs_json`, `merge_history`, and internal recovery metadata are never inputs to the current search vector.
- Provider sync UI must distinguish an available adapter from a configured or successfully synchronized provider.
- Engagement summaries may be incomplete when their owning module is absent or the actor lacks access; the Contacts timeline must say so rather than leak or fabricate data.

## Alternatives Considered

- Keep all data in `attrs_json`: rejected because provenance, uniqueness, indexing, consent history, and reliable synchronization cannot be enforced.
- Put Contacts teams in the kernel: rejected for this slice because the kernel must remain product-neutral and no shared collaboration contract exists yet.
- Make Contacts a full CRM engagement owner: rejected because it would duplicate Calendar, Communications, and Planning authority.
- Claim immediate two-way provider sync: rejected because no qualified credentials, conflict policy, or provider deletion semantics exist.

## Implementation Evidence

- Model-registry and module-migration scope tests resolve every new table to `contacts.core`.
- Focused backend tests cover organization/team isolation, primary-fact reconciliation, consent history, anonymizing purge, import preview/execution/rollback, persisted duplicate candidates, saved-view ownership, vCard round trips, manual group lifecycle, team and custom-field recoverable lifecycle, preserved membership/value state, stale-intent rejection, bounded group reads, and generated-group reconciliation.
- Focused frontend tests cover the draggable Groups Manager, capability-aware controls, manual/generated/empty/archived filters, focus restoration, localization, and RTL behavior.
- Migration `003_contacts_core_system_of_record.sql` owns the additive system-of-record tables, indexes, and relationship constraints.
- Migration `004_contacts_core_merge_privacy.sql` removes private legacy merge payloads from party attributes and replaces the raw JSON search index with the explicit public field allowlist.
- The module verifier removes its temporary membership and archives its temporary manual group. The legacy verifier-group operation is dry-run-first, requires exact command/event evidence, and can only archive after a reviewed plan and backup.

## Required Production Qualification

- Run backend format, lint, type, focused/unit/integration, migration, model-registry, and candidate-verifier gates.
- Run frontend tests plus accessibility, localization/RTL, 320 px, 200% text, appearance, keyboard, touch-target, and static-build checks.
- Rebuild the local PostgreSQL stack and complete authenticated API/browser smoke checks with `contacts.core` installed.
- Preserve the generated evidence and record any failed or skipped gate; do not infer a production-ready state from source presence alone.

## Rollback

Disable the new Contacts controls and stop new writes while retaining additive tables for evidence and compatibility. The legacy flat projection allows the previous read surface to continue during rollback. Do not drop governance, consent, import, or audit records as part of application rollback. Migration 004 does not restore private legacy snapshots on application rollback; any pre-migration backup contains sensitive PII and is reserved for an explicitly approved full-data recovery, not ordinary merge recovery.

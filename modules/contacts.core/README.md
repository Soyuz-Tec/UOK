# contacts.core

**Status:** Active optional capability module.

**Current candidate:** `UOK-3.1.0-alpha.3`

`contacts.core` is the governed UOK Party and Contacts system of record for people, organizations, first-class contact facts, consent evidence, Contacts-owned teams, grouping, relationships, review/quality state, import evidence, saved views, duplicate candidates, external identities, and custom fields.

Backend and ORM ownership live under `modules/contacts.core/backend`; module migrations live under `modules/contacts.core/migrations`; production React, app hooks, and CSS live under `modules/contacts.core/web/src`; behavior and frontend tests live under `modules/contacts.core/tests`; candidate proof lives under `modules/contacts.core/verify`.

Other modules consume actor-authorized Party references through typed boundaries. Contacts remains the canonical Party owner, and derived profiles do not become a hidden source of truth. Contacts does not own messages, meetings, tasks, opportunities, or other engagement records.

The current modernization includes five governed Groups Manager slices and seven Contacts system slices: persistent manual groups, safe membership, exact generated reconciliation, bounded group reads/hygiene, a draggable capability-aware manager, first-class facts, privacy/consent/team authorization, guided transfer/bulk workflows, persisted quality/dedupe/rollback, saved views/relationship productivity, genuine activity/vCard boundaries, and governed custom fields. Live Google, Microsoft, or CardDAV synchronization is not claimed until a provider adapter is separately implemented and qualified.

Authoritative references:

- Architecture decision: `docs/architecture/ADR-0027-contacts-system-of-record-governance-and-interoperability.md`
- Implementation plan and evidence map: `docs/modules/contacts.core/CONTACTS_APP_PLAN.md`
- Migrations: `modules/contacts.core/migrations/README.md`
- Candidate verification: `modules/contacts.core/verify/README.md`
- Cleanup, backup, and rollback operations: `docs/operations/UOK_CONTACTS_CORE_OPERATIONS.md`

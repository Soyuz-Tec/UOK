# ADR-0006: Planning Task Participant Party Boundary

**Status:** Accepted

**Current candidate:** `UOK-3.1.0-alpha.3`

**Approved:** 2026-07-10

## Context

Planning tasks need responsible people and operational contacts that can be
filtered, reviewed, and audited independently of capacity resources. Canonical
Party identity belongs to `contacts.core`, which is optional and owns Party
authorization, lifecycle, privacy, and retention. A direct foreign key would
couple module install/uninstall and purge policy; free-text names would create
duplicate, ungoverned identities.

## Decision

- Add a Planning-owned task participant record containing project/task scope,
  canonical Party identity, controlled role, source module, creation actor,
  timestamps, and Planning audit correlation.
- Participant roles are `owner`, `assignee`, `approver`, `consulted`,
  `informed`, and `external_contact`. A Party may hold multiple roles, but the
  same Party/role pair is unique per task.
- `party_id` intentionally has no database foreign key to `parties`.
  `contacts.core` continues to own identity, access, lifecycle, and deletion.
- Addition requires `planning.edit`, a live `contacts.core` provider,
  `contacts.read`, an active same-organization Party, idempotency, and a current
  strong Planning ETag. Missing, denied, and unavailable Parties fail closed.
- Existing participants survive Contacts disablement or Party archival as
  explicit unavailable records. Actor-specific reads return `ready`,
  `unavailable`, `denied`, or `missing`; denied results hide Party identity and
  display label.
- Participant changes increment the project revision and affected task version,
  enter the strong actor-visible ETag, emit correlated module/schedule events,
  and enter complete baseline snapshots.
- The task read model exposes actor-visible Party IDs and roles for filtering.
  The People inspector selects canonical Parties through the Contacts API; the
  People view and saved filters use the same validated schedule representation.
- Participants are distinct from capacity resources. Gate C may correlate a
  human resource with a Party, but it must not collapse responsibility roles
  into allocation/capacity semantics.

## Consequences

- Planning can query responsibility and communication roles without copying
  Contacts records or coupling module migrations.
- Provider resolution adds bounded reads; Gate E must measure and batch/cache
  them for large portfolios.
- A provider lifecycle or authorization change can change the strong ETag
  without a Planning revision, as required for actor-visible representation.
- Participant records for archived tasks remain retained but are excluded from
  active schedule reads and new baselines.

## Alternatives

- A direct Party foreign key was rejected because optional-module lifecycle and
  purge policy would be coupled.
- A single `owner_party_id` task column was rejected because tasks require
  multiple Parties and governed roles.
- Reusing Planning resources was rejected because responsibility, approval,
  consultation, and notification are not capacity allocations.
- Free-text participant names were rejected because they bypass canonical
  identity, organization scope, lifecycle, and privacy.

## Validation

- additive PostgreSQL 18 migration apply/readback after backup;
- same-organization ready, cross-organization missing, provider-disabled,
  actor-denied, duplicate-role, and permission-denial tests;
- project revision, task version, ETag, baseline, and audit correlation proof;
- typed client, People inspector/view, participant filter, and saved-view tests;
- rebuilt candidate lifecycle and Chromium UI proof.

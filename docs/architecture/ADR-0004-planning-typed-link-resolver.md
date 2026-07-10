# ADR-0004: Planning Typed Cross-Module Link Resolver

**Status:** Accepted

**Current candidate:** `UOK-3.1.0-alpha.3`

**Approved:** 2026-07-10

## Context

Planning Gate B must connect projects and tasks to operation objects without
hard foreign keys into optional modules or copying provider payloads. UOK does
not currently expose an Operation Graph or K Connect thread provider. It does
have organization-scoped canonical parties, report artifacts, and calendar
events with module lifecycle and permission boundaries.

A Planning link must survive target-module disablement, must not leak target
details to an unauthorized actor, and must participate in project revision,
ETag, baseline, event, and audit evidence.

## Decision

Add a module-owned `PlanningLink` record and resolver registry.

- A link stores project/task scope, a controlled relationship, target kind and
  stable identity, the server-selected resolver name/version, blocking intent,
  sanitized resolution summary, and correlation provenance.
- No link has a foreign key into an optional target module. The target module
  continues to own authorization, lifecycle, privacy, and retention.
- Resolver selection is server-owned. Clients cannot nominate arbitrary code
  or store raw provider responses.
- Each schedule read resolves links for the current actor. `ready`,
  `unavailable`, `denied`, and `missing` are distinct states. A denied result
  hides target identity and label; disabled/deleted targets remain explicit and
  the Planning link is not silently removed.
- Link creation rejects denied and missing targets. It may retain an
  `unavailable` reference when an approved optional provider is not installed,
  making the boundary explicit without asserting target existence.
- Create/remove commands require `planning.link`, stable idempotency, a current
  strong ETag, one project transaction/revision, and correlated events.
- Actor-visible resolution participates in the strong schedule ETag. Immutable
  baselines capture the link identities and resolution states visible to the
  authorized creator.

Initial live resolvers are:

| Target kinds | Resolver | Provider |
|---|---|---|
| `party` | `contacts.party` v1 | `contacts.core` canonical Party |
| `document`, `evidence` | `reports.artifact` v1 | `reports.core` ReportArtifact |
| `calendar_event` | `calendar.event` v1 | `calendar.core` CalendarEvent |

Operation, gate, shipment, location, asset, agreement, and communication-thread
resolver names are reserved but return `unavailable` until their provider
modules implement the contract. They must not be presented as resolved source
objects before then.

The ORM mapping remains in the accepted alpha compatibility bridge under
`src/uok/planning_models.py`; behavior, migration, APIs, resolver logic, tests,
and verification remain owned by `planning.core`. ACC-ARCH-001 continues to
track eventual physical model relocation.

## Consequences

- Planning can add source-object references without coupling optional module
  migrations or deletion lifecycles.
- Read-model resolution adds bounded provider lookups. Gate E performance work
  must measure and batch/cache these lookups before large portfolio claims.
- A target provider changing state can change an actor-visible ETag without a
  Planning revision, which is correct for a strong representation validator.
- Unavailable optional references are honest integration debt, not proof that
  Operation Graph or K Connect exists.

## Alternatives

- Direct cross-module foreign keys were rejected because optional module
  uninstall/retention and privacy policies would become coupled.
- A generic kernel relation table was rejected because no approved Operation
  Graph contract exists and Planning-specific logic must not enter the kernel.
- Raw JSON provider snapshots were rejected because they duplicate identity,
  become stale, and can leak protected target details.
- Blocking Gate B until every target module exists was rejected because the
  typed unavailable-state contract can be implemented and verified safely now.

## Validation

- additive migration apply/readback on PostgreSQL 18;
- ready, missing, cross-organization, denied, and disabled-provider tests;
- direct API capability-denial and idempotent/concurrent mutation proof;
- baseline checksum/readback containing link identity;
- typed client build and capability-gated Links inspector tests;
- Planning candidate link scenario and full UOK gates.

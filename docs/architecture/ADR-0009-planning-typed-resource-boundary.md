# ADR-0009: Planning Typed Resource Boundary

**Status:** Accepted

**Current candidate:** `UOK-3.1.0-alpha.3`

**Approved:** 2026-07-10

## Context

Planning currently identifies a resource only by name and role, assumes every
resource has 100 percent capacity, and cannot distinguish a person from a
vehicle, equipment, material, budget, location, or other constrained input.
Gate C needs queryable resource facts before calendars, resource-specific
free/busy, or explainable leveling can be correct.

Participants and resources are different concepts. A participant records
responsibility and communication. A resource records capacity consumed by work.
One canonical Party may appear in both roles, but the records cannot be merged.

## Decision

Extend the Planning-owned `PlanningResource` aggregate with:

- a controlled type: `human`, `team`, `vehicle`, `equipment`, `material`,
  `budget`, `time_window`, `document`, `location`, `asset`, or `custom`;
- a positive decimal capacity value and a type-compatible controlled unit;
- optional typed canonical target kind and stable target identity;
- optional effective start and end calendar dates.

Type/unit compatibility is enforced in the API, generic command path,
SQLAlchemy model, and PostgreSQL migration. Examples include human FTE or
hours/day, team people, vehicle/equipment units or hours/day, material units or
physical quantity, budget currency, and location units.

Canonical targets use the existing actor-specific resolver contract. Planning
stores no cross-module foreign key or copied provider payload. Missing and
denied targets cannot be attached; unavailable optional providers may retain a
stable reference; denied reads hide target identity. Type-to-target
compatibility is controlled, such as human/team to Party and location to
location.

Existing rows backfill compatibly as `human`, capacity `1`, unit `fte`.
Assignment `allocation_percent` remains the share of a resource's declared
capacity. This slice persists and exposes effective dates but does not yet make
them a daily capacity calendar; ACC-RES-002 owns that next behavior.

The accepted alpha compatibility bridge keeps the ORM mapping in
`src/uok/planning_resource_models.py`; behavior, validation, migration, tests, candidate
proof, and UI remain owned by `planning.core`.

## Consequences

- Resource facts are typed, queryable, baseline-captured, revisioned, audited,
  and available to later capacity-calendar and leveling engines.
- Invalid type/unit and type/canonical-reference combinations fail before a
  schedule mutation and again at the database boundary.
- The Resources inspector becomes more explicit but remains inside progressive
  disclosure; the default remains one human FTE for compatibility.
- Current daily load percentages and simple leveling still use the existing
  100-percent relative-capacity model until ACC-RES-002 and ACC-RES-003.

## Alternatives

- Generic JSON attributes were rejected because the scheduler, validator,
  database, generated API, and UI could not enforce one contract.
- Reusing task participants was rejected because responsibility does not imply
  capacity consumption and non-human resources are not Parties.
- Direct foreign keys to optional provider modules were rejected because they
  couple lifecycle, retention, authorization, and migrations.

## Validation

- human, team, vehicle, equipment, material, budget, and location round trips;
- invalid type/unit, reference-pair, reference-kind, and effective-date tests;
- actor-specific canonical Party resolution and stable strong ETag behavior;
- database constraint rejection and PostgreSQL catalog readback;
- complete immutable baseline capture of typed resource facts;
- typed Resources inspector and generated OpenAPI build;
- candidate runtime and full UOK verification gates.

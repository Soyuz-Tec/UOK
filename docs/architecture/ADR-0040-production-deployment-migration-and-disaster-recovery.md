# ADR-0040: Production Deployment, Migration, and Disaster Recovery

**Status:** Proposed

**Implementation status:** Planned

**Date:** 2026-08-09

**Owners:** Runtime and release owners

**Relations:** Related to ADR-0024, ADR-0033, and ADR-0036

## Context

UOK has a pinned container build, local Podman Compose profile, immutable
prerelease design, schema discipline, readiness probe, and backup/restore
verification assets. It has no accepted production topology, replica count,
migration rollout strategy, secrets provider, RPO/RTO, regional failure model,
or qualified rollback procedure.

## Decision

Select and qualify a production platform before go-live. Deploy immutable image
digests, externalize secrets, route only to ready instances, serialize schema
migrations, and require backward-compatible expand/migrate/contract changes
across the rollback window. Define backup encryption, restore drills, RPO/RTO,
capacity headroom, deployment health gates, rollback versus roll-forward
criteria, and ownership for database, object data, and signing keys. Release
evidence must bind source, image, migration set, configuration class, and
restored data proof.

## Consequences

Deployment and recovery claims become measurable, but a platform choice and
operational cost are unavoidable. Database migrations may constrain instant
application rollback and therefore require staged compatibility.

## Alternatives

- Treating local Compose as production was rejected because it has one API,
  one database, local secrets, and no platform failure-domain proof.
- Rebuilding images per environment was rejected by ADR-0033's build-once
  identity.
- Unqualified automatic migration on every replica was rejected because it can
  race and break rollback compatibility.

## Validation

Require same-digest staging promotion, migration concurrency and rollback-window
tests, encrypted backup plus independent restore drills, availability fault
injection, capacity/load evidence, secrets rotation, and measured RPO/RTO. A
production release remains blocked until these results are attached to the
release evidence.

## Rollback

Roll back by immutable digest only while the schema remains compatible.
Otherwise use an approved roll-forward or restore plan. Never down-migrate or
restore production data without a validated recovery point and explicit
incident authority.

## Revisit triggers

Revisit when accepting this proposal, selecting the production platform,
changing data stores or regions, missing an RPO/RTO target, or introducing a
non-backward-compatible migration.

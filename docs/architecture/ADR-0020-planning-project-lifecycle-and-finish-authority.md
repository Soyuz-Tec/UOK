# ADR-0020: Planning Project Lifecycle and Finish Authority

**Status:** Accepted

**Current candidate:** `UOK-3.1.0-alpha.3`

**Approved:** 2026-07-10

## Context

Planning projects previously defaulted to an unconstrained text status and used
one `end` value as both a compatibility horizon and CPM target. CPM could also
normalize a weekend or holiday commitment to a prior working day. That made the
project lifecycle, archive write-safety, target commitment, and persisted
calculated finish implicit. Immutable analysis artifacts require those facts to
be explicit before capture.

## Decision

- Project status is controlled as `draft`, `active`, `on_hold`, `completed`,
  `archived`, or internal `purged`. Existing and new projects remain compatible
  by defaulting to `active`.
- Only the reason-required `TransitionPlanningProject` command may change
  status. It uses the reviewed transition graph, project lock, strong ETag,
  idempotency, revision ledger, transactional outbox, and exact command
  correlation. Same-state, unknown, forbidden, and public purge transitions
  fail closed.
- Archived projects remain readable, including revision history, but every
  non-transition Planning mutation fails before task, event, or revision
  changes. A reasoned `archived -> active` transition restores mutation access.
  Purged projects are omitted from public project, schedule, baseline,
  what-if, risk, optimization, recommendation, portfolio, and history reads.
  The kernel resolves a mismatched idempotency-key reuse to its stable `409`
  before invoking a module guard. For an exact replay, the generic module
  replay guard resolves project identity from exact revision correlation or an
  allowlisted legacy result shape, then takes the project read lock and checks
  current visibility. Archived projects still replay pre-archive successes;
  purged projects return non-disclosing not-found with no recovered project ID
  or command correlation. Internal purge and replay therefore serialize on the
  same project row; the transaction that acquires it first determines whether
  that replay completes before purge or observes the purged state afterward.
- `target_finish_at` is the exact user commitment. Creation copies `end_at`;
  scheduling, calendar, leveling, and analysis writes never rewrite it.
- `calculated_finish_at` persists the authoritative CPM finish. Project
  creation evaluates the no-task CPM result, and every successful scheduler
  mutation refreshes it. Reads publish both persisted project values and the
  independently calculated result; a mismatch is an explicit validation error
  and blocks complete baseline or what-if capture until a scheduler write
  repairs it.
- `end_at` remains the compatibility horizon and compatible `end` API field.
  Calendar availability reads through the latest of that horizon, persisted
  calculated finish, and non-deleted task finishes. Leveling uses the explicit
  target commitment as its latest-finish boundary.
- CPM engine `uok-cpm-2` preserves weekend and holiday targets exactly while
  using a separate prior-working-day anchor for backward-pass math. Negative
  float remains visible when calculated finish exceeds the commitment. New
  risk and optimization outputs use engine version `2` and require a CPM-v2
  snapshot. Approved legacy recommendations cannot newly apply; already
  applied legacy recommendations remain rollback-capable.
- Migration `015_planning_project_lifecycle_targets.sql` preflights existing
  project/task statuses, backfills target from `end_at`, and conservatively
  backfills calculated finish from the maximum non-deleted task `end_at` or
  project start. That compatibility backfill is not asserted to be canonical
  CPM; mismatch evidence remains visible until the first scheduler mutation.

The migration requires a quiesced Planning write path. It takes table locks,
adds non-null columns, and is not compatible with older instances continuing to
insert projects. Deploy the migration and matching application as one stopped-
writer step. Do not claim rolling-deploy or old-binary rollback compatibility;
database rollback is forward-fix only because no destructive down migration is
provided.

## Consequences

- Project commitment and calculated finish are separately queryable and stable.
- Lifecycle writes have the same concurrency, replay, audit, ledger, and outbox
  evidence as schedule writes.
- Archive becomes a recoverable read-only state rather than a delete alias.
- Legacy rows can expose an honest calculated-finish mismatch until repaired.
- Existing complete-v2/legacy baseline, what-if snapshot, analysis-run, and
  applied-recommendation artifacts stay historical; they are not silently
  reinterpreted as CPM v2.

## Alternatives

- Reusing task status rules was rejected because project lifecycle and purge
  visibility have different authority and transition semantics.
- Treating `end` as both target and calculated finish was rejected because a
  scheduler result must not move an operator commitment.
- Normalizing a non-working target in place was rejected because it changes the
  committed date.
- Synthetic CPM backfill was rejected because existing persisted schedules may
  not contain enough evidence to reproduce prior calculation context safely.
- A rolling-compatible nullable phase was rejected for this local alpha slice;
  the required quiesced migration boundary is documented instead.

## Validation

- exhaustive project transition policy, permission, reason, ETag, exact replay,
  mismatch-first conflict, legacy no-ledger result, non-disclosing purge,
  correlation, ledger, outbox, archive, restore, and both PostgreSQL replay/purge
  project-lock orderings;
- additive migration, project/task status, non-null, order, and conservative
  backfill checks;
- CPM-v2 weekend/holiday, negative-float, persisted equality, divergence,
  repair, target-stability, and immutable-capture tests;
- legacy analysis/recommendation apply and rollback compatibility tests;
- generated OpenAPI, typed frontend build, source policy, Planning suite, and
  PostgreSQL candidate verifier coverage without a `production_ready` claim.

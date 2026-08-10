# UOK Architecture Decision Registry

This registry is the authoritative lifecycle view for UOK architecture
decisions. Individual ADR status lines are retained as historical decision
text; when they differ, this registry controls. Decision status and
implementation status are deliberately separate: accepting a decision does not
claim that it is active in a production runtime.

New decisions start from [ADR_TEMPLATE.md](ADR_TEMPLATE.md). IDs are allocated
once, never reused, and validated by `python scripts/adr_policy.py`. A material
change gets a new ADR that amends or supersedes the old one; historical ADR
content is not silently rewritten.

| ID | Decision status | Implementation status | Date | Owners | Relations | Evidence | Revisit trigger |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [ADR-0001](ADR-0001-module-extension-runtime-boundaries.md) | Superseded | Historical | 2026-07-06 | UOK architecture maintainers | Superseded by ADR-0021, ADR-0022, and ADR-0028 | Source and tests cited in ADR | Extension-point ownership changes |
| [ADR-0002](ADR-0002-planning-gantt-and-ui-proof-dependencies.md) | Accepted | Implemented | 2026-07-09 | Planning owners | None | Planning proof suite cited in ADR | Gantt renderer or proof stack changes |
| [ADR-0003](ADR-0003-planning-gate-a-stabilization.md) | Accepted | Implemented | 2026-07-09 | Planning owners | Umbrella stabilization decision | Planning traceability and verification suite | Gate A contract changes |
| [ADR-0004](ADR-0004-planning-typed-link-resolver.md) | Accepted | Implemented | 2026-07-10 | Planning owners | None | Planning link tests cited in ADR | Cross-module link contract changes |
| [ADR-0005](ADR-0005-planning-date-semantics.md) | Accepted | Implemented | 2026-07-10 | Planning owners | None | Planning date tests cited in ADR | Date authority changes |
| [ADR-0006](ADR-0006-planning-task-participant-boundary.md) | Accepted | Implemented | 2026-07-10 | Planning owners | None | Participant tests cited in ADR | Participant ownership changes |
| [ADR-0007](ADR-0007-planning-task-requirements-and-readiness.md) | Accepted | Implemented | 2026-07-10 | Planning owners | None | Requirement tests cited in ADR | Readiness contract changes |
| [ADR-0008](ADR-0008-communications-thread-provider-boundary.md) | Accepted | Implemented | 2026-07-10 | Communications owners | Amended by ADR-0029 | Communications tests cited in ADR | Provider boundary changes |
| [ADR-0009](ADR-0009-planning-typed-resource-boundary.md) | Accepted | Implemented | 2026-07-10 | Planning owners | Amended by ADR-0010 and ADR-0012 | Resource tests cited in ADR | Resource model changes |
| [ADR-0010](ADR-0010-planning-resource-capacity-calendars.md) | Accepted | Implemented | 2026-07-10 | Planning owners | Amends ADR-0009 | Capacity tests cited in ADR | Capacity authority changes |
| [ADR-0011](ADR-0011-planning-resource-calendar-correlation.md) | Accepted | Implemented | 2026-07-10 | Planning owners | Related to ADR-0010 | Calendar correlation tests cited in ADR | Calendar correlation changes |
| [ADR-0012](ADR-0012-planning-explainable-resource-leveling.md) | Accepted | Implemented | 2026-07-10 | Planning owners | Amends ADR-0009 and ADR-0010 | Leveling tests cited in ADR | Leveling algorithm changes |
| [ADR-0013](ADR-0013-planning-immutable-what-if-snapshots.md) | Accepted | Implemented | 2026-07-10 | Planning owners | None | Snapshot tests cited in ADR | Scenario persistence changes |
| [ADR-0014](ADR-0014-planning-reproducible-risk-analysis.md) | Accepted | Implemented | 2026-07-10 | Planning owners | None | Risk-analysis tests cited in ADR | Risk model changes |
| [ADR-0015](ADR-0015-planning-governed-optimization-and-recommendations.md) | Accepted | Implemented | 2026-07-10 | Planning owners | Related to ADR-0012 and ADR-0014 | Optimization tests cited in ADR | Recommendation authority changes |
| [ADR-0016](ADR-0016-planning-scale-budgets-and-virtualization.md) | Accepted | Implemented | 2026-07-10 | Planning owners | None | Scale proof cited in ADR | Scale budgets change |
| [ADR-0017](ADR-0017-uok-localization-bidirectional-and-touch-boundary.md) | Accepted | Implemented | 2026-07-10 | Frontend platform owners | None | Accessibility and UI proof cited in ADR | Locale or input boundary changes |
| [ADR-0018](ADR-0018-planning-portfolio-and-release-readiness.md) | Accepted | Implemented | 2026-07-10 | Planning owners | None | Portfolio tests cited in ADR | Release-readiness contract changes |
| [ADR-0019](ADR-0019-planning-revision-ledger-and-transactional-outbox.md) | Accepted | Implemented | 2026-07-10 | Planning owners | Delivery semantics deferred to ADR-0042 | Transaction and PostgreSQL proof cited in ADR | External delivery is introduced |
| [ADR-0020](ADR-0020-planning-project-lifecycle-and-finish-authority.md) | Accepted | Implemented | 2026-07-10 | Planning owners | None | Lifecycle tests cited in ADR | Finish authority changes |
| [ADR-0021](ADR-0021-module-manifest-runtime-and-release-truth.md) | Accepted | Implemented | 2026-07-10 | UOK architecture maintainers | Supersedes part of ADR-0001 | Manifest validation and release tests | Manifest contract changes |
| [ADR-0022](ADR-0022-module-owned-orm-registration.md) | Accepted | Implemented | 2026-07-10 | UOK architecture maintainers | Supersedes part of ADR-0001 | Model registry tests | ORM ownership changes |
| [ADR-0023](ADR-0023-module-local-frontend-composition.md) | Accepted | Implemented | 2026-07-10 | Frontend platform owners | Related to ADR-0028 and ADR-0041 | Catalog and frontend tests | Frontend composition changes |
| [ADR-0024](ADR-0024-database-connection-pooling.md) | Accepted | Implemented | 2026-07-11 | Runtime owners | Related to ADR-0031 | Capacity policy and runtime proof | Pool topology changes |
| [ADR-0025](ADR-0025-uniform-workspace-command-surface-and-action-vocabulary.md) | Accepted | Implemented | 2026-07-12 | Frontend platform owners | None | UI tests cited in ADR | Command vocabulary changes |
| [ADR-0026](ADR-0026-calendar-integrity-and-appointments-boundary.md) | Accepted | Implemented | 2026-07-13 | Calendar owners | None | Calendar integrity tests | Appointment boundary changes |
| [ADR-0027](ADR-0027-contacts-system-of-record-governance-and-interoperability.md) | Accepted | Implemented | 2026-07-24 | Contacts owners | Historical umbrella decision; future changes require atomic ADRs | Contacts source, migrations, and tests cited in ADR | Any listed concern changes independently |
| [ADR-0028](ADR-0028-host-composition-and-neutral-module-surface-contracts.md) | Accepted | Implemented | 2026-07-16 | Frontend platform owners | Supersedes part of ADR-0001; amended by ADR-0030 | Host contract and catalog tests | Host port changes |
| [ADR-0029](ADR-0029-communications-thread-recoverable-delete-and-concurrency.md) | Accepted | Implemented | 2026-07-15 | Communications owners | Amends ADR-0008 | Concurrency and lifecycle tests | Thread lifecycle changes |
| [ADR-0030](ADR-0030-request-authoritative-frontend-async-boundary.md) | Accepted | Partial | 2026-07-30 | Frontend platform owners | Amends ADR-0028 | Compliance and Contacts adoption tests | Remaining module owners adopt the boundary |
| [ADR-0031](ADR-0031-postgresql-least-privilege-and-tenant-rls-foundation.md) | Accepted | Inactive | 2026-07-24 | Security and runtime owners | Related to ADR-0024 | Offline verifier and dormant SQL policy | Production RLS activation prerequisites close |
| [ADR-0032](ADR-0032-http-response-and-public-surface-security.md) | Accepted | Implemented | 2026-07-24 | Security and runtime owners | None | HTTP security tests | Proxy or public-surface topology changes |
| [ADR-0033](ADR-0033-immutable-prerelease-supply-chain.md) | Accepted | Partial | 2026-07-25 | Release owners | Depends on ADR-0035 | Release workflow validators and policy tests | First protected prerelease completes |
| [ADR-0034](ADR-0034-legacy-credential-retirement-and-auth-rate-limits.md) | Accepted | Implemented | 2026-07-25 | Security owners | Related to ADR-0037 | Authentication and password tests | Distributed auth or external IAM is enabled |
| [ADR-0035](ADR-0035-python-alpine-runtime-base.md) | Accepted | Implemented | 2026-07-25 | Runtime and security owners | Supports ADR-0033 | Container policy and compatibility tests | Base digest, libc need, or scan posture changes |
| [ADR-0036](ADR-0036-fault-containment-availability-and-health-boundaries.md) | Accepted | Partial | 2026-08-09 | UOK architecture maintainers | Related to ADR-0023, ADR-0028, and ADR-0041 | Error-boundary and health-probe tests | Stronger process or deployment isolation is required |
| [ADR-0037](ADR-0037-server-authoritative-session-and-distributed-auth-controls.md) | Proposed | Planned | 2026-08-09 | Security owners | Would amend ADR-0034 | Threat model and auth integration proof required | Multi-replica or external IAM work begins |
| [ADR-0038](ADR-0038-data-retention-erasure-legal-hold-and-reference-integrity.md) | Proposed | Planned | 2026-08-09 | Data governance owners | Related to ADR-0027 | Retention matrix and restore-safe purge tests required | Regulated production data is onboarded |
| [ADR-0039](ADR-0039-observability-slos-and-diagnostic-telemetry.md) | Proposed | Planned | 2026-08-09 | Runtime owners | Related to ADR-0036 | SLI collector exists; telemetry proof required | Production SLOs or alert routing are selected |
| [ADR-0040](ADR-0040-production-deployment-migration-and-disaster-recovery.md) | Proposed | Planned | 2026-08-09 | Runtime and release owners | Related to ADR-0024, ADR-0033, and ADR-0036 | Local recovery evidence exists; production proof required | Production platform is selected |
| [ADR-0041](ADR-0041-frontend-chunk-loading-and-style-isolation.md) | Proposed | Planned | 2026-08-09 | Frontend platform owners | Would amend ADR-0023 and ADR-0036 | Bundle, load-failure, and style-leak tests required | Module count or bundle budget grows |
| [ADR-0042](ADR-0042-event-dispatch-delivery-and-reconciliation-semantics.md) | Proposed | Planned | 2026-08-09 | Integration and runtime owners | Extends ADR-0019 | Dispatcher and consumer contract tests required | Any event leaves its owning transaction boundary |
| [ADR-0043](ADR-0043-external-integration-adapter-and-webhook-boundary.md) | Proposed | Planned | 2026-08-09 | Integration and security owners | Depends on ADR-0037, ADR-0039, and ADR-0042 | Provider sandbox and failure-injection proof required | First live provider is selected |

## Status rules

- Proposed means the direction is recorded for review but is not authority to
  ship the design.
- Accepted means the decision is authoritative; implementation status states
  whether the repository/runtime has realized it.
- Superseded and Rejected decisions remain in place as historical context.
- Implemented means repository behavior and relevant tests exist. It does not
  by itself mean production promotion, external configuration, or a live
  release has completed.
- Partial and Inactive must identify their activation or completion trigger in
  this registry and in the ADR.

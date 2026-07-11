# Planning Gantt Implementation Traceability

**Status:** Gates A-E locally runtime-proven; hosted CI, review, and merge pending.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Owning decision:** `docs/architecture/ADR-0003-planning-gate-a-stabilization.md`

## Purpose

This artifact distinguishes implemented source from verified behavior and gives
reviewers one place to find the acceptance test and evidence for every Gate A
requirement.

## Evidence states

| State | Required evidence |
|---|---|
| `planned` | Owner and acceptance condition recorded |
| `source_present` | Reviewable source exists |
| `unit_tested` | Focused deterministic test passes |
| `integration_tested` | API/database/module interaction passes |
| `runtime_proven` | Candidate runtime/UI proof is saved |
| `production_ready` | Security, performance, recovery, observability, and release gates pass in a production-like profile |

## Gate A traceability

| ID | Requirement | Initial evidence | Required proof before closure | Status |
|---|---|---|---|---|
| PLA-A-001 | Canonical CPM values | Logic-driven, calendar-aware CPM returns ES, EF, LS, LF, total/free float, target variance, and critical flags independent of stored dates and UI order | Independent chain, parallel, merge, lag/lead, calendar, target-date, and cycle fixtures | `runtime_proven` |
| PLA-A-002 | Independent hard-constraint validation | Separate validators recompute CPM coverage, durations, dependencies, calendars, constraints, manual dates, float, project finish, target variance, and resource/day capacity results on accepted writes/read models | Injected CPM and capacity faults are rejected; candidate readback proves a 120% overload point and a clean post-level result | `runtime_proven` |
| PLA-A-003 | Stable Planning idempotency | UOK command gateway supports replay | Every REST write requires a client key; module-command missing-key, replay, changed-payload conflict, lost-response retry, and original-command correlation tests pass | `runtime_proven` |
| PLA-A-004 | Optimistic concurrency | Project revision/task version migration, strong actor-visible ETag, project lock, 428/412 recovery contract, and typed client recovery exist | PostgreSQL two-client race, candidate runtime, and accessible reload/reapply proof | `runtime_proven` |
| PLA-A-005 | Atomic batch mutation | The typed ten-kind registry applies ordered task, dependency, assignment, calendar, link, and gate operations under one project lock, command/idempotency record, final scheduler/validator pass, revision, ETag, and correlated evidence; bulk UI and every reversible represented history kind use the endpoint | 100-operation success/replay, all-kind mixed success, late mixed-family rollback, one-revision/task-version, same-project source-command, capability isolation, generated-contract, structured-error, and correlation proofs pass | `runtime_proven` |
| PLA-A-006 | Complete immutable baseline | Canonical v2 snapshot includes the complete current schedule graph/context, creator/source revision/correlation metadata, SHA-256 verification, append-only guards, comparison reads, and explicit legacy partial limitations | PostgreSQL migration apply/readback and candidate runtime checksum proof | `runtime_proven` |
| PLA-A-007 | Server capability enforcement | Server maps every command to `read`, `edit`, `baseline.create`, `level`, `link`, `gate.approve`, or `admin`; schedule/API return actor authority; UI fails closed and local review mode can only reduce it | Candidate runtime role matrix and direct-denial proof | `runtime_proven` |
| PLA-A-008 | Database invariant enforcement | Additive migration enforces dates, duration, progress, sort order, task/dependency types, scheduling mode, lag, allocation, unique project calendars/assignments, and supporting indexes | PostgreSQL 18 apply/readback and direct invalid-row probes | `runtime_proven` |
| PLA-A-009 | Structured Planning errors | Planning validation, permission, idempotency, precondition, and atomic-batch failures return stable code, field, object ids, repair, revision, and correlation id through REST and generic command paths; persisted failure logs store the same envelope | Candidate runtime proof for validation, denial, and missing-precondition envelopes | `runtime_proven` |
| PLA-A-010 | Typed Planning client | Explicit request/result/error contracts cover projects, tasks, dependencies, calendars, baselines, resources, assignments, batches, revisions, capabilities, history, and workspace actions | Candidate UI proof for the accessible repair/audit alert | `runtime_proven` |
| PLA-A-011 | End-to-end audit correlation | Every successful Planning response, module event, and schedule event carries the exact command-log ID, including derived task changes and batches | Candidate PostgreSQL join/readback across command, response, and both event streams | `runtime_proven` |
| PLA-A-012 | Accessible non-drag alternatives | Keyboard and inspector paths exist | Start/end movement and resize, progress, dependency, and create flows are proven without dragging in Chromium | `runtime_proven` |
| PLA-A-013 | Controlled task status lifecycle | Status is server-owned and typed across request/read contracts | Unknown values return structured `422`; valid transitions succeed; forbidden transitions return structured errors without mutation; candidate lifecycle probe passes | `runtime_proven` |
| PLA-A-014 | Revision-aware safe history | Supported inverse operations carry the originating command and execute atomically against the current revision | Chromium proves undo source correlation, redo after a remote revision returns `412`, latest server state remains intact, and unsupported history fails closed | `runtime_proven` |
| PLA-A-015 | Accessible focus and state recovery | Inline editing and error notices expose stable focus targets | Successful keyboard edits restore focus; stale mutation and inverse failures focus and announce repair guidance without unsafe automatic replay | `runtime_proven` |
| PLA-A-016 | Evidence governance and lifecycle | Feature catalog, module plan, architecture index, ADR, module tests, and verifier use one evidence taxonomy and module-owned paths | Ambiguous catalog labels are removed, source-size checks pass, and install/enable/verify/rebuild candidate lifecycle is exercised | `runtime_proven` |
| PLA-A-017 | Immutable revision and outbox evidence | Every successful guarded command appends one checksummed project-revision ledger row and one schema-v1 internal outbox envelope in the same transaction; history is actor-scoped and raw payloads remain private | Creation/derived-version/correlation checks, post-insert rollback, replay, exact source lookup, poisoning regression, PostgreSQL concurrency/immutability/tenant/envelope probes, and rebuilt candidate proof pass | `runtime_proven` |
| PLA-A-018 | Controlled project lifecycle and finish authority | Reasoned project transitions, read-only archive/restore, non-disclosing internal purge, exact target commitment, persisted CPM-v2 finish, and compatibility horizon are explicit contracts | Exhaustive guarded transition edges, generated contracts, migration invariants, finish mismatch/repair, immutable-capture rejection, rebuilt candidate lifecycle/finish readback, and both PostgreSQL replay/purge project-lock orderings | `runtime_proven` |

## Current slice evidence

- Draft review and exact current-head checks: [PR #20](https://github.com/Soyuz-Tec/UOK/pull/20)
- Backend REST integration proof: `modules/planning.core/tests/test_planning_rest_idempotency.py`
- Runtime/generated OpenAPI parity proof: `modules/planning.core/tests/test_planning_idempotency_contract.py`
- Generic command replay/conflict integration and synthetic insert-race recovery regression: `modules/planning.core/tests/test_planning_command_idempotency.py`
- Shared command-conflict regression: `modules/contacts.core/tests/test_contacts_command_safety.py`
- Frontend key propagation and lost-response retry proof: `web/src/features/planning/planningApi.test.ts`
- Backend revision, task-version, strict ETag, stale-write, replay-order, and route-coverage proof: `modules/planning.core/tests/test_planning_optimistic_concurrency.py`
- Additive module migration: `modules/planning.core/migrations/002_planning_optimistic_concurrency.sql`
- Live PostgreSQL two-client row-lock verifier: `modules/planning.core/verify/runtime/verify_planning_postgres_concurrency.py`
- Live PostgreSQL exact-replay/purge two-order project-lock verifier: `modules/planning.core/verify/runtime/verify_planning_replay_purge_concurrency.py`
- Typed frontend stale-write recovery and fail-closed multi-write proof: `web/src/features/planning/planningApi.test.ts` and `web/src/features/planning/usePlanningWorkspaceMutations.test.tsx`
- Candidate PostgreSQL proof: two simultaneous writes returned exactly one `200` and one `412`; repeated concurrent reads never observed a mixed revision/schedule snapshot.
- Candidate/UI gates: `scripts/verify_uok_candidate.ps1` and `web/e2e/uok-proof.spec.ts` pass with atomic bulk controls enabled only through the batch endpoint.
- Canonical CPM and hand-worked oracle cases: `modules/planning.core/tests/test_canonical_cpm.py`
- Independent result validation with injected dependency, calendar, constraint, and manual-date faults: `modules/planning.core/tests/test_cpm_validation.py`
- Independent resource-capacity calculation/validation with valid overload and injected load/flag/coverage faults: `modules/planning.core/tests/test_resource_capacity_validation.py`
- API target-variance and UI-row-order independence proof: `modules/planning.core/tests/test_planning_cpm_contract.py`
- Persistent candidate negative-float/independent-validation proof: `modules/planning.core/verify/runtime/verify_planning_cpm.py`
- Atomic 100-operation success/replay, injected rollback, one-revision/task-version, structured-error, and correlation proof: `modules/planning.core/tests/test_planning_atomic_batch.py`
- Typed bulk and bounded multi-task history client proof: `web/src/features/planning/planningApi.test.ts`, `web/src/features/planning/usePlanningWorkspaceMutations.test.tsx`, and `web/src/features/planning/planningHistoryExecution.test.ts`
- Complete v2 baseline capture, checksum, compare, legacy, immutability, and tamper proof: `modules/planning.core/tests/test_planning_complete_baselines.py`
- Additive v2 baseline metadata/append-only migration: `modules/planning.core/migrations/003_planning_complete_baselines.sql`
- Typed baseline detail/compare reads and legacy UI warning proof: `web/src/features/planning/planningApi.test.ts` and `web/e2e/uok-proof.spec.ts`
- Candidate PostgreSQL proof: 12 existing snapshots classified as v1 `partial`; v2 columns/checks/index/trigger read back; trigger rejected mutation; v2 snapshot checksum/detail/correlation passed the live candidate verifier.
- Server capability mapping and adversarial direct-call denials: `modules/planning.core/tests/test_planning_capabilities.py`
- Typed fail-closed capability client and review-only UI proof: `web/src/features/planning/usePlanningCapabilities.test.tsx` and `web/e2e/uok-proof.spec.ts`
- Candidate runtime proof: operations receives edit/baseline/level/admin, viewer receives read-only, viewer direct project creation remains denied, and module verification passes after rebuild.
- Database constraint/duplicate rejection and additive migration proof: `modules/planning.core/tests/test_planning_database_invariants.py` and `modules/planning.core/migrations/004_planning_database_invariants.sql`
- End-to-end command/response/module-event/schedule-event correlation proof: `modules/planning.core/tests/test_planning_audit_correlation.py`
- Immutable revision/outbox transaction, checksum, sanitized API, replay, rollback, and source-link poisoning proof: `modules/planning.core/tests/test_planning_revision_outbox.py`
- PostgreSQL/ORM storage guards and generated public-contract privacy proof: `modules/planning.core/tests/test_planning_revision_storage_guards.py` and `modules/planning.core/tests/test_planning_revision_openapi_contract.py`
- Additive PostgreSQL ledger/outbox schema and guards: `modules/planning.core/migrations/014_planning_revision_outbox.sql`
- Rollback-only live PostgreSQL mutation, tenant, source-project, and envelope guard probes: `modules/planning.core/verify/runtime/verify_planning_revision_outbox.sql`
- Architecture boundary: `docs/architecture/ADR-0019-planning-revision-ledger-and-transactional-outbox.md`
- Structured validation/permission/precondition error and persisted command-log parity proof: `modules/planning.core/tests/test_planning_structured_errors.py`
- Structured idempotency conflict proof: `modules/planning.core/tests/test_planning_command_idempotency.py` and `modules/planning.core/tests/test_planning_rest_idempotency.py`
- Typed request propagation, typed domain/precondition mapping, repair-status propagation, and accessible alert proof: `web/src/features/planning/planningApi.test.ts`, `web/src/features/planning/usePlanningWorkspaceMutations.test.tsx`, and `web/src/features/planning/PlanningErrorNotice.test.tsx`
- Controlled status registry, request-shape validation, transition enforcement, audit correlation, and no-mutation rejection proof: `modules/planning.core/tests/test_planning_status_policy.py`
- Revision-aware source-command history and stale inverse proof: `modules/planning.core/tests/test_planning_atomic_batch.py`, `web/src/features/planning/planningHistoryExecution.test.ts`, `web/src/features/planning/usePlanningWorkspaceMutations.test.tsx`, and `web/e2e/uok-proof.spec.ts`
- Keyboard-only mutation and shared focus-restoration proof: `web/src/shared/forms/InlineTextEdit.test.tsx` and `web/e2e/uok-proof.spec.ts`
- Candidate runtime proof: the module verifier inspected structured `403`, `400`, and `428` bodies and correlations; Chromium focused and announced the repair/field/revision/audit alert after a rejected mutation.
- Candidate PostgreSQL proof: all 13 invariant constraints and four indexes read back; direct invalid date/progress/scheduling-mode and duplicate calendar/assignment rows were rejected; seven candidate schedule events and seven module events all linked to succeeded commands, with all seven stored responses carrying the same correlation.
- Generated REST contract: `web/src/generated/openapi.json` and `web/src/generated/openapi.d.ts`

## Gate B traceability

| ID | Requirement | Current evidence | Required proof before Gate B closure | Status |
|---|---|---|---|---|
| PLA-B-001 | Typed cross-module links | Additive `PlanningLink` migration/model, server-owned resolver registry, REST/command APIs, typed client, capability-gated inspector, baseline inclusion, and ready/missing/cross-org/denied/disabled-provider tests | PostgreSQL 18 readback and candidate scenario pass; activate real target providers before claiming their target kinds ready | `runtime_proven` |
| PLA-B-002 | Planned/forecast/actual/deadline semantics | Additive project timezone/task date migration, scheduler/fact authority split, dedicated audited mutation, variance read model, typed client, explicit UI labels, and visual-only subday disclosure | New York spring/fall DST storage, reason/order/permission/ETag rejection, planned-move actual preservation, PostgreSQL readback, baseline capture, and candidate scenario pass | `runtime_proven` |
| PLA-B-003 | First-class participants | Additive participant model/migration, controlled roles, actor-safe canonical Party resolver, guarded REST/commands, task version/filter read model, baseline/audit evidence, People inspector/view, and saved filter | Same-org ready, cross-org missing, provider-disabled, denied-identity, duplicate, permission, PostgreSQL readback, candidate lifecycle, and Chromium proof pass | `runtime_proven` |
| PLA-B-004 | Gates and evidence blockers | Planning-owned requirement model/state machine, separate edit/approve authority, audited evidence-source replacement with review invalidation, matching typed links, provider-aware fail-closed task/project readiness, task version/revision/ETag, audit/baseline integration, typed Gates inspector, dashboard/list status, and not-ready saved filter | PostgreSQL 18 readback, candidate lifecycle, provider-outage re-block, and Chromium proof pass | `runtime_proven` |
| PLA-B-005 | Communication thread jump | Real `communications.core` thread provider, permission contract, Planning adapter, URL-derived workspace selection, exact-thread K Connect UI, focused lifecycle/denial tests, and Chromium deep-link proof | PostgreSQL readback, rebuilt candidate lifecycle, full candidate verifier, and complete Chromium suite pass | `runtime_proven` |

Current Gate B link evidence:

- ADR: `docs/architecture/ADR-0004-planning-typed-link-resolver.md`
- Migration/model/manifest: `modules/planning.core/migrations/005_planning_operation_links.sql`, `modules/planning.core/backend/uok_planning_core/planning_models.py`, and `modules/planning.core/manifest.yaml`
- Resolver/API/audit/baseline integration: `modules/planning.core/backend/uok_planning_core/link_resolver.py`, `link_commands.py`, `link_read_model.py`, and `baselines.py`
- Cross-organization, denied, disabled-provider, correlation, and baseline proof: `modules/planning.core/tests/test_planning_links.py`
- Typed client and capability-gated inspector proof: `web/src/features/planning/planningApi.test.ts` and `PlanningOperationLinksPanel.test.tsx`
- Candidate runtime scenario: `modules/planning.core/verify/UokCandidatePlanningLinks.ps1`
- Persistent PostgreSQL proof: `planning_links`, null-safe identity uniqueness, four checks, three foreign keys, and all three access indexes read back after backup and additive migration; full candidate and five Chromium scenarios passed after rebuild.

Current Gate B date-semantics evidence:

- ADR: `docs/architecture/ADR-0005-planning-date-semantics.md`
- Migration: `modules/planning.core/migrations/006_planning_date_semantics.sql`
- Backend contract and DST/audit proof: `modules/planning.core/tests/test_planning_date_semantics.py`
- Typed browser editor proof: `web/src/features/planning/PlanningTaskDateFields.test.tsx` and `web/src/features/planning/planningApi.test.ts`
- Candidate runtime scenario: `modules/planning.core/verify/UokCandidatePlanningDates.ps1`
- Persistent PostgreSQL proof: project timezone, five execution-date columns, four checks, and deadline index read back after backup; rebuilt candidate preserved project-local New York dates, rejected an actual correction without a reason, and passed the module verifier.

Current Gate B participant evidence:

- ADR: `docs/architecture/ADR-0006-planning-task-participant-boundary.md`
- Migration: `modules/planning.core/migrations/007_planning_task_participants.sql`
- Backend resolution/version/baseline/audit proof: `modules/planning.core/tests/test_planning_participants.py`
- Typed inspector/filter proof: `web/src/features/planning/PlanningParticipantsPanel.test.tsx`, `planningTimelineModel.test.ts`, and `planningApi.test.ts`
- Candidate runtime scenario: `modules/planning.core/verify/UokCandidatePlanningParticipants.ps1`
- Persistent PostgreSQL proof: 11 columns, controlled role/source checks, three same-module foreign keys, unique Party/role membership, and two access indexes read back after backup; rebuilt candidate proved ready/disabled/permission lifecycle and baseline capture.

Current Gate B requirement/readiness evidence:

- ADR: `docs/architecture/ADR-0007-planning-task-requirements-and-readiness.md`
- Migration: `modules/planning.core/migrations/008_planning_task_requirements.sql`
- Lifecycle, authorization, evidence-link, outage, version, baseline, and audit proof: `modules/planning.core/tests/test_planning_requirements.py`
- Runtime/generated OpenAPI parity: `modules/planning.core/tests/test_planning_idempotency_contract.py`
- Typed Gates inspector/API/filter proof: `web/src/features/planning/PlanningRequirementsPanel.test.tsx`, `planningRequirementsApi.test.ts`, and `planningTimelineModel.test.ts`
- Candidate runtime scenario: `modules/planning.core/verify/UokCandidatePlanningRequirements.ps1`
- Persistent PostgreSQL proof: 17 columns, three controlled type/state/decision checks, four foreign keys, and both organization-first state/due indexes read back after backup and additive migration; rebuilt candidate proved approval lifecycle, permission denial, readiness recovery, and baseline inclusion, while five Chromium scenarios proved the Gates inspector and blocker status.

Current Gate B communication-thread evidence:

- ADR and provider plan: `docs/architecture/ADR-0008-communications-thread-provider-boundary.md` and `docs/modules/communications.core/COMMUNICATIONS_CORE_MODULE_PLAN.md`
- Provider migration/model/manifest: `modules/communications.core/migrations/001_communications_core.sql`, `modules/communications.core/backend/uok_communications_core/models.py`, and `modules/communications.core/manifest.yaml`
- Command, policy, API, lifecycle, and audit proof: `modules/communications.core/tests/test_communications_core.py`
- Planning ready/denied/missing/disabled-provider resolver proof: `modules/planning.core/tests/test_planning_communication_links.py`
- Exact workspace/thread navigation proof: `web/src/app/workbenchNavigation.test.ts`, `web/src/features/communications/CommunicationsWorkspace.test.tsx`, `web/src/features/planning/PlanningOperationLinksPanel.test.tsx`, and `web/e2e/uok-proof.spec.ts`
- Candidate lifecycle scenario: `modules/planning.core/verify/UokCandidatePlanningLinks.ps1` and `modules/communications.core/verify/UokCandidateCommunications.ps1`
- Persistent PostgreSQL proof: 11 columns, one controlled lifecycle check, two foreign keys, and both organization-first indexes read back after backup and additive migration; the rebuilt candidate passed provider install/disable/enable, permission denial, and exact link resolution, while all six Chromium scenarios passed.

## Gate C traceability

| ID | Requirement | Current evidence | Required proof before Gate C closure | Status |
|---|---|---|---|---|
| PLA-C-001 | Typed resources and capacities | Additive resource fields/migration, controlled type-unit and type-reference compatibility, positive decimal capacity, effective dates, actor-specific canonical resolution, generic-command and REST validation, immutable baseline capture, generated client, and typed Resources inspector | PostgreSQL readback and rebuilt candidate round-trip pass | `runtime_proven` |
| PLA-C-002 | Resource calendars and effective capacity | One resource-scoped capacity calendar, effective-period/weekday/holiday/exception precedence, guarded update command/route, engine v2, independent validation, baseline capture, typed UI/API, and resource-aware leveling | PostgreSQL readback and rebuilt candidate pass | `runtime_proven` |
| PLA-C-003 | Resource-specific calendar free/busy | Provider-owned Party-filtered occurrence/free-busy facade, actor-visible participant/resource correlation, exact task IDs, unrelated-event exclusion, private Party denial, and linked-context ETag proof | Rebuilt candidate correlation and full gates pass | `runtime_proven` |
| PLA-C-004 | Explainable leveling outcomes | Versioned `simple_forward` strategy, bounded configured horizon, explicit leveled/partial/infeasible result, exact changed tasks and remaining overloads, stable reasons, immutable-baseline rule, audit evidence, typed UI, and separate post-level validator | Rebuilt candidate feasible/infeasible result and baseline-integrity proof | `runtime_proven` |

Current Gate C typed-resource evidence:

- ADR: `docs/architecture/ADR-0009-planning-typed-resource-boundary.md`
- Migration/model: `modules/planning.core/migrations/009_planning_typed_resources.sql` and `modules/planning.core/backend/uok_planning_core/planning_resource_models.py`
- Contract, resolver-safe read model, baseline, database, and invalid-combination proof: `modules/planning.core/tests/test_planning_typed_resources.py`
- Typed inspector proof: `web/src/features/planning/PlanningResourcePanel.test.tsx`
- Candidate scenario: `modules/planning.core/verify/UokCandidatePlanningResources.ps1`
- Persistent PostgreSQL proof: 12 columns, seven controlled resource checks, two foreign keys, both new organization-first indexes, and zero incompatible backfills read back after backup and additive migration; the rebuilt candidate rejected an invalid vehicle/FTE pair, round-tripped a 0.5-FTE human effective period, preserved independently validated overload analysis, and captured the typed facts in an immutable baseline.

Current Gate C resource-calendar evidence:

- ADR: `docs/architecture/ADR-0010-planning-resource-capacity-calendars.md`
- Migration/model: `modules/planning.core/migrations/010_planning_resource_calendars.sql` and `modules/planning.core/backend/uok_planning_core/planning_resource_models.py`
- Capacity derivation, mutation, overlap/bounds, baseline, independent validation, and leveling proof: `modules/planning.core/tests/test_planning_resource_calendars.py`
- Engine fault-injection regression: `modules/planning.core/tests/test_resource_capacity_validation.py`
- Typed inspector/workload/API proof: `web/src/features/planning/PlanningResourcePanel.test.tsx`, `planningWorkloadModel.test.ts`, and `planningResourceCalendarApi.test.ts`
- Candidate scenario: `modules/planning.core/verify/UokCandidatePlanningResources.ps1`
- Persistent PostgreSQL proof: 11 columns, one capacity-range check, one organization/resource uniqueness constraint, three foreign keys, and all three indexes read back after backup and additive migration; the rebuilt candidate round-tripped a reduced-capacity exception, reported a validated 120% allocation against 50% capacity, and captured the resource calendar in the immutable baseline.

Current Gate C calendar-correlation evidence:

- ADR: `docs/architecture/ADR-0011-planning-resource-calendar-correlation.md`
- Provider filter and Planning correlation: `modules/calendar.core/backend/uok_calendar_core/read_model.py` and `modules/planning.core/backend/uok_planning_core/calendar_bridge.py`
- Two-resource correlation, unrelated-event exclusion, private Party denial, and empty-correlation proof: `modules/planning.core/tests/test_planning_calendar_core_integration.py`
- Actor-visible context/ETag regression: `modules/planning.core/tests/test_planning_concurrency_guards.py`
- Candidate scenario: `modules/planning.core/verify/UokCandidatePlanningAvailability.ps1`
- Rebuilt candidate evidence passed the exact task/Party correlation, unrelated-event exclusion, warning, and full module lifecycle gates.

Current Gate C explainable-leveling evidence:

- ADR: `docs/architecture/ADR-0012-planning-explainable-resource-leveling.md`
- Strategy and command orchestration: `modules/planning.core/backend/uok_planning_core/resource_leveling.py` and `leveling_command.py`
- Independent post-level validator and injected hidden-overload fault: `modules/planning.core/backend/uok_planning_core/resource_leveling_validation.py` and `modules/planning.core/tests/test_planning_explainable_leveling.py`
- Feasible, partial, infeasible, manual, capacity, horizon, and resource-calendar proofs: `modules/planning.core/tests/test_task_scheduling_modes.py`, `test_planning_explainable_leveling.py`, and `test_planning_resource_calendars.py`
- Configured typed UI and accessible result-status proof: `web/src/features/planning/PlanningLevelingControl.test.tsx`
- Candidate baseline-integrity and infeasibility scenario: `modules/planning.core/verify/UokCandidatePlanningLeveling.ps1`
- Rebuilt candidate evidence passed explicit infeasibility, configured horizon, remaining overload, capacity/horizon reasons, independent validation, and approved-baseline checksum integrity.

## Gate D traceability

| ID | Requirement | Current evidence | Required proof before Gate D closure | Status |
|---|---|---|---|---|
| PLA-D-001 | Immutable what-if snapshots | Additive append-only model/migration, complete approved capture, bounded typed temporary changes, detached CPM/capacity preview, SHA-256 integrity, actor-scoped read API, distinct analysis capability, typed inspector, and audit correlation | PostgreSQL trigger/readback and rebuilt candidate non-mutation proof | `runtime_proven` |
| PLA-D-002 | Reproducible risk analysis | Verified snapshot checksum, fixed seed, bounded triangular task inputs, named correlation groups, versioned CPM-per-sample engine, limits, P50/P80/P90/P95, target probability, confidence assumptions, independent validation, typed UI, checksum, and append-only audit record | Exact same-input reproduction, PostgreSQL readback, and candidate percentile proof | `runtime_proven` |
| PLA-D-003 | Bounded governed optimization | Dependency-reviewed first-party advisory engine, verified snapshot input, objective/engine/version, time/candidate limits, explicit completed/timeout/infeasible, explanations, ranked impact/effort/side effects/assumptions, preview, and independent validation | Representative chain, timeout/infeasible fixtures, 50-task benchmark, PostgreSQL readback, and candidate proof | `runtime_proven` |
| PLA-D-004 | Governed recommendation lifecycle | Persistent controlled state machine, distinct analyze/approve/edit authority, reasoned decision, stale-safe apply, schedule validation, exact audit correlation, rollback, transition trigger, and typed UI | Unauthorized/early denial plus rebuilt candidate approve/apply/audit/rollback proof | `runtime_proven` |

Current Gate D what-if evidence:

- ADR: `docs/architecture/ADR-0013-planning-immutable-what-if-snapshots.md`
- Model/migration: `modules/planning.core/backend/uok_planning_core/planning_analysis_models.py` and `modules/planning.core/migrations/011_planning_what_if_snapshots.sql`
- Canonical capture, detached preview, integrity, and actor-scoped reads: `modules/planning.core/backend/uok_planning_core/what_if.py` and `analysis_api.py`
- Immutability, idempotency, permissions, non-mutation, and preview proof: `modules/planning.core/tests/test_planning_what_if_snapshots.py`
- Typed Analysis inspector proof: `web/src/features/planning/PlanningAnalysisPanel.test.tsx`
- Candidate scenario: `modules/planning.core/verify/UokCandidatePlanningWhatIf.ps1`
- Persistent PostgreSQL proof: 11 columns, three checks, three foreign keys, five indexes, one immutable trigger, and direct update rejection read back after backup and additive migration; rebuilt candidate preserved approved task fields/version while verifying the preview checksum.

Current Gate D risk evidence:

- ADR: `docs/architecture/ADR-0014-planning-reproducible-risk-analysis.md`
- Engine, normalized inputs, correlations, limits, percentiles, and independent checks: `modules/planning.core/backend/uok_planning_core/risk_engine.py`
- Immutable persistence, checksum, actor-scoped reads, and audit: `modules/planning.core/backend/uok_planning_core/risk_analysis.py`, `analysis_api.py`, and `analysis_commands.py`
- Exact reproduction, contract rejection, non-mutation, and ORM immutability: `modules/planning.core/tests/test_planning_risk_analysis.py`
- Typed fixed-seed Analysis inspector proof: `web/src/features/planning/PlanningAnalysisPanel.test.tsx`
- Candidate scenario: `modules/planning.core/verify/UokCandidatePlanningRisk.ps1`
- Persistent PostgreSQL proof: 16 columns, four checks, four foreign keys, six indexes, one immutable trigger, and direct update rejection read back after backup `uok_pg18_20260710-092303.dump` and additive migration; two same-input candidate runs produced the same checksum.

Current Gate D optimization/lifecycle evidence:

- ADR/dependency review: `docs/architecture/ADR-0015-planning-governed-optimization-and-recommendations.md`
- Bounded engine, objectives, limits, timeout/infeasible handling, ranking, and independent checks: `modules/planning.core/backend/uok_planning_core/optimizer_engine.py`
- Immutable optimization run plus controlled recommendation lifecycle: `modules/planning.core/backend/uok_planning_core/optimization.py` and `analysis_commands.py`
- Representative, permission, early-apply, approval, apply, audit, rollback, stale, and direct-transition proofs: `modules/planning.core/tests/test_planning_governed_optimization.py`
- Benchmark: `modules/planning.core/tests/test_planning_optimizer_benchmark.py` measured about 0.25 seconds for 50 candidates across a 50-task chain on the local candidate.
- Typed approval workflow proof: `web/src/features/planning/PlanningAnalysisPanel.test.tsx`
- Candidate scenario: `modules/planning.core/verify/UokCandidatePlanningOptimization.ps1`
- Persistent PostgreSQL proof: 23 columns, six checks, six foreign keys, seven indexes, one transition trigger, and direct rolled-back-to-approved rejection read back after backup `uok_pg18_20260710-094209.dump` and additive migration; rebuilt candidate completed propose/approve/apply/rollback.

## Gate E traceability

| ID | Requirement | Current evidence | Required proof before Gate E closure | Status |
|---|---|---|---|---|
| PLA-E-001 | Measured performance budgets | Executable rollback-only profile captures database/runtime/hardware, all samples, p95/mean/max, approved thresholds, and zero retained fixture rows for schedule read, deterministic validation, and atomic batch scenarios | Rebuilt PostgreSQL profile and full-gate repeat | `runtime_proven` |
| PLA-E-002 | Measurement-triggered virtualization | Unwindowed 500-row Chromium breach recorded; dependency-free window activates only above 200 rows with shared variable-height geometry, 480px overscan, synchronized grid/timeline scroll, total row metadata, and full small-schedule fallback | Full Chromium trace with interaction/long-task/mounted-count evidence and accessibility regression proof | `runtime_proven` |
| PLA-E-003 | Keyboard, touch, accessibility, and responsive closure | Non-drag paths plus virtual-boundary focus handoff, ARIA total/index metadata, coarse-pointer 44px row action, touch selection, zero unnamed buttons, 320px reflow, 200% root text, screenshot, and console proof | Full regression/candidate repeat | `runtime_proven` |
| PLA-E-004 | UOK-wide localization and RTL | Shared English/Arabic provider, workbench preference, English fallback, Arabic numerals, document metadata, translated shell/Planning labels, logical CSS/pinned offsets, and LTR chronology isolate | Representative RTL render, persistence, shared-provider unit test, and policy/ADR | `runtime_proven` |
| PLA-E-005 | Portfolio and multi-project views | Actor-scoped bounded aggregate, typed filters/metrics/health/timeline/drill-in UI, diagnostics, Server-Timing, and candidate readback pass | Exact authorization, six-query populated path, component, Chromium, and runtime proof | `runtime_proven` |
| PLA-E-006 | Production-like closure | Standard operation composes health, candidate contracts, PostgreSQL scale, persistent CPM/concurrency recovery, live Chromium compatibility/accessibility/console checks, and engineering evidence | Full rebuilt candidate repeat and summarized PR evidence | `runtime_proven` |

Current Gate E scale evidence:

- Decision and dependency review: `docs/architecture/ADR-0016-planning-scale-budgets-and-virtualization.md`
- Repeatable budgets/profile: `docs/operations/UOK_PLANNING_SCALE_BUDGETS.md` and `scripts/planning_scale_benchmark.py`
- Backend executable proof: `modules/planning.core/tests/test_planning_scale_benchmark.py`
- Shared virtual window and boundary tests: `web/src/features/planning/planningGanttVirtualization.ts` and `planningGanttVirtualization.test.ts`
- Aligned renderer integration: `PlanningGantt.tsx`, `PlanningGanttGrid.tsx`, and `PlanningGanttGridRow.tsx`
- Browser budget/trace: `web/e2e/planning-scale.spec.ts`
- PostgreSQL profile: read p95 96.51 ms, validation p95 16.52 ms, batch p95 190.75 ms; zero persisted benchmark projects.
- Controlled single-worker Chromium verification profile: 1,179.30 ms interaction, 34 mounted grid/timeline rows, and no post-idle long task; unwindowed baseline 4,073.60 ms.

Current Gate E reach evidence:

- Architecture and policy: `docs/architecture/ADR-0017-uok-localization-bidirectional-and-touch-boundary.md` and `docs/design/UOK_LOCALIZATION_AND_BIDIRECTIONAL_POLICY.md`
- Shared provider/registry: `web/src/shared/localization/UokLocalization.tsx`
- Preference/document/account integration: `useWorkbenchPreferences.ts`, `App.tsx`, and `AccountMenu.tsx`
- Logical/touch implementation: Planning Gantt grid/header/cell/row styles and `web/src/styles/accessibility.css`
- Shared unit/persistence proof: `UokLocalization.test.tsx` and `App.test.tsx`
- Keyboard boundary proof: `web/e2e/planning-scale.spec.ts`
- Arabic RTL, touch, target, unnamed-button, 320px, 200%-text, persistence, screenshot, and console proof: `web/e2e/planning-reach.spec.ts`

Current Gate E portfolio and release evidence:

- Decision and operations: `docs/architecture/ADR-0018-planning-portfolio-and-release-readiness.md` and `docs/operations/UOK_PLANNING_RELEASE_READINESS.md`
- Bounded actor-scoped aggregate/API: `portfolio.py`, `portfolio_api.py`, and `test_planning_portfolio.py`
- Typed UI and focused proof: `PlanningPortfolioView.tsx`, `PlanningPortfolioView.test.tsx`, and `web/e2e/uok-proof.spec.ts`
- Runtime candidate contract: `modules/planning.core/verify/UokCandidatePlanningPortfolio.ps1`
- Production-like composition/live proof: `scripts/uok_ops.ps1` action `PlanningReleaseReadiness` and `web/e2e/planning-live.spec.ts`

Exact commit SHAs and workflow-run identifiers belong in the mutable PR body and
GitHub check rollup so this durable map does not become stale when an evidence
commit changes the branch head.

## Current idempotency boundary

The current UOK command log scopes keys by organization and rechecks the
replaying actor's permission and module state. Persisted actor/application
scoping and original-actor audit attribution are not yet present in the command
log schema. They remain required before `production_ready` and are tracked with
the Gate A audit-correlation work rather than inferred from PLA-A-003's current
integration evidence.

Command type and canonical request bytes are compared before any module replay
guard runs, preserving the stable `409` contract for mismatched key reuse. Only
an exact succeeded replay enters Planning's visibility guard. It resolves newer
commands through the immutable revision correlation and supports allowlisted
legacy no-ledger result shapes, including the schedule result retained after a
dependency was deleted. The guard then takes the project read lock: visible and
archived projects may replay the original result, while purged projects return
not-found without recovered project IDs or command correlation. Internal purge
uses the same project row as its serialization boundary.

## Current optimistic concurrency boundary

The project schedule is the aggregate revision root. Existing-project Planning
commands lock that project row, validate exactly one quoted strong `If-Match`
tag, execute the Python-authoritative mutation, increment the project revision
once, and increment every changed existing task version once in the same
transaction. Project creation starts at revision `1`; new tasks start at version
`1`.

The validator format is `"planning-r<revision>-sha256-<canonical digest>"`. The
digest covers the canonical actor-visible schedule, including calendar
availability context, rather than treating the revision number alone as a
strong validator. Missing tags return `428`; valid stale tags return `412` with
the current revision, tag, reload URL, and explicit repair guidance. Weak tags,
wildcards, lists, and malformed tags return `400`. Idempotent replay is checked
before first-execution precondition validation so a lost successful response can
still replay with its original tag.

Bulk task edits and reversible task, dependency, calendar, and assignment
history now use one project-scoped atomic batch. The registry supports exactly
`update_task`, `create_dependency`, `update_dependency`,
`remove_dependency`, `assign_resource`, `unassign_resource`, `set_calendar`,
`create_link`, `remove_link`, and `transition_gate`. Create/delete-task and
resource-leveling history still fail closed because those actions are outside
the approved registry rather than falling back to independent writes.
The project lock serializes Planning mutations, but `calendar.core`
availability remains read-only advisory context and is not locked by a Planning
transaction.

## Current atomic batch boundary

`POST /api/planning/projects/{project_id}/mutations:batch` accepts 1 to 500
ordered operations, one stable idempotency key, and the current strong ETag.
The generated OpenAPI contract is a ten-branch discriminated union with a
strict payload model for every kind. The command applies all operations in one
transaction, runs schedule propagation and independent validation once over
the final proposed state, increments the project revision once, increments each
materially changed task version once, and emits one `PlanningBatchApplied`
event plus one module-owned schedule event carrying the command correlation id.
Link and gate operations retain their domain events under that same
correlation. A source command must be successful, organization-scoped, and
present by exact correlation in this project's immutable revision ledger;
schedule-event payload search is not authoritative. Link operations retain
`planning.link`; gate decisions retain `planning.gate.approve`, so
`planning.edit` cannot escalate authority through a batch. Any operation or
final schedule failure rolls the complete transaction back and returns a
structured error.

## Required reference schedule cases

| Case | Expected evidence |
|---|---|
| Single chain | Correct early/late dates, zero-float critical path |
| Parallel paths | Shorter path receives correct float |
| Merge point | Longest predecessor controls merge date |
| FS, SS, FF, SF | Type-specific precedence holds |
| Positive lag / negative lead | Calendar-aware relation arithmetic is correct |
| Weekend and holiday | Non-working dates are excluded consistently |
| Milestone | Zero duration and equal start/finish |
| Summary | Excluded from CPM graph; dates/progress roll up from descendants |
| Manual task conflict | Dates stay fixed and a violation is returned |
| Target date | Negative float is reported rather than clamped away |
| Dependency cycle | Mutation is rejected and no partial write remains |

## Current server capability boundary

`planning.manage` is replaced by explicit `planning.edit`,
`planning.baseline.create`, `planning.level`, `planning.link`,
`planning.gate.approve`, `planning.analyze`, `planning.analysis.approve`, and `planning.admin` permissions alongside
`planning.read`. Every existing command maps to exactly one declared permission;
dependency editing remains schedule edit authority, while `planning.link` is
reserved for Gate B cross-module links.

The actor-specific capability matrix is returned by
`GET /api/planning/capabilities` and embedded in each schedule read model. The
operations role receives all current capabilities, the trader role receives
read/edit, and finance/viewer roles remain review-only. The frontend defaults to
review-only until the server matrix loads, disables specialized baseline and
leveling actions independently, and cannot use its local review toggle to grant
server authority. Direct REST and generic-command probes remain denied even
when callers supply valid IDs, ETags, and idempotency keys.

## Current database and audit boundary

Migration `004_planning_database_invariants.sql` is additive and leaves prior
numbered migrations unchanged. It enforces project/task date order, nonnegative
duration and sort order, 0-100 progress, accepted task/dependency types,
non-self dependencies, -30 to +30 day lag/lead, 1-300 allocation, auto/manual
scheduling mode, one project calendar, and one assignment per
organization/task/resource. It also adds organization-first hierarchy,
predecessor, successor, and resource-assignment indexes. Existing foreign-key
`NO ACTION` behavior and the manifest retention policy continue to prevent
implicit destructive cascades.

Every Planning handler now uses one module-local audit adapter. The adapter
overwrites any caller-provided correlation field with the authoritative command
log ID and writes it to both event streams. The concurrency wrapper adds the
same ID to every successful REST/generic result after the final revision and
ETag are calculated, so response metadata cannot change schedule truth. Failed
commands use the same command-log ID as their returned error correlation, and
the persisted response body is the exact returned structured envelope.

Migration `014_planning_revision_outbox.sql` adds a separate immutable
revision ledger and one internal outbox envelope for every newly committed
Planning revision. Both rows are inserted before the command transaction
commits, so a failure removes schedule, ledger, and outbox together and an
idempotent replay adds no duplicate. The exact command ID joins the ledger to
the existing response and event streams. Public history returns sanitized
metadata and checksums, never raw outbox payloads or actor identity. Existing
projects are not given synthetic history, and this slice has no dispatcher,
retry, published-state, broker, or external-delivery claim.

## Current structured error and typed client boundary

Planning command validation, capability denial, idempotency conflict, optimistic
precondition, and atomic-batch failure responses use transport-neutral error
objects. Each object identifies a stable code, human message, relevant field and
object IDs, a repair action, the current revision when available, and an audit
correlation ID. Validation and precondition failures persist the same envelope
against the attempted command; permission denials persist a denied command; an
idempotency conflict references the original successful command. Request-shape
validation that fails before command acceptance returns the same repair-oriented
shape with a request correlation but does not claim a persisted command record.

The browser client validates those envelopes at the HTTP boundary and exposes
typed domain and precondition errors. Mutation intents, history, Gantt inline
edits, inspector forms, dependencies, calendars, baselines, resources,
assignments, and batch updates now use explicit Planning request types. Domain
failures render a focused `role=alert` containing the server message, repair,
field, current revision, and audit reference. Unknown or legacy failure bodies
remain a generic API error and cannot enter stale-write recovery.

## Current complete baseline boundary

New baselines are schema version `2`, immutable, and append-only. Their
canonical JSON captures project identity/revision/target/timezone, all tasks and
hierarchy, scheduling modes and constraints, dependencies, the Planning
calendar and exceptions, resources, assignments, actor-visible typed-link
identities and resolver states, calculated metrics/engine version, creator,
timestamp, and command
correlation. The stored SHA-256 checksum is recomputed for schedule reads,
detail reads, and comparisons.

Existing rows are additively backfilled as schema version `1` with
`completeness=partial`; their missing facts are returned explicitly and compare
fails closed. PostgreSQL rejects baseline updates and deletes with a migration
trigger, while SQLAlchemy rejects ORM mutations in every profile. The comparison
read reports exact added, removed, and changed object IDs only when both inputs
are complete and hash verified.

## Current CPM boundary

The `uok-cpm-2` engine calculates a logic-driven earliest schedule from the
project start, task durations, hard date constraints, manual dates, working
calendar, and the dependency graph. Persisted planned dates remain the approved
schedule displayed by the Gantt; they are not relabeled as CPM early dates.
Summary tasks are excluded from the graph and dependency links to summaries are
rejected.

ADR-0020 separates the exact persisted `target_finish` commitment and
authoritative persisted `calculated_finish` from the compatible project `end`
horizon. Weekend and holiday targets remain exact; a separate prior-working-day
anchor drives the backward pass. When calculated finish exceeds target,
negative float is reported without moving or clamping the commitment. Every
scheduler mutation persists canonical CPM, while conservative migration
backfill mismatches remain explicit validation errors and block immutable
capture until repaired.

Project status is controlled through the reasoned transition command. Archived
projects remain readable and history-visible but reject every other Planning
mutation without revision, task-version, or event drift; active restoration is
explicit. Internal purge has no public transition and hides every public
project-scoped read family plus exact pre-purge command results. Changed-payload
idempotency reuse remains a mismatch-first `409`; exact replay is serialized
with purge on the project row and fails without recovered object or correlation
identifiers once purge wins. The lifecycle migration requires quiesced writers
and makes no rolling-deploy or old-binary rollback claim.

The independent validators deliberately live outside their calculation engines.
One recomputes CPM hard invariants from the published result; the other
recomputes resource/day coverage, allocation totals, contributing task IDs,
capacity, working-day placement, and overload flags. Over-allocation remains an
explicit warning rather than a hard scheduling constraint, but a corrupted or
incomplete capacity result now fails independent validation.

## Closure rule

A row may advance only when the evidence is present on the current branch and
the narrow relevant check passes. `production_ready` requires the production
hardening profile and cannot be inferred from local alpha tests.

The 2026-07-10 closure sweep passed all Planning tests, all 193 frontend tests,
the static production build, ten runtime-independent Chromium scenarios, the
live Planning Chromium scenario, TechnologyAudit, EngineeringEvidence
generation, Rebuild, persistent CPM-v2 and both replay/purge lock-order
verifiers, the full candidate verifier, and the repository Verify action. The
feature stack remains in draft review: hosted CI is externally blocked by the
GitHub account billing state, and no merge or production deployment was
performed.

Before Gate A closes, link this artifact from:

- `docs/DOCUMENTATION_INDEX.md`;
- `docs/ARCHITECTURE.md`;
- `docs/modules/planning.core/PLANNING_CORE_MODULE_PLAN.md`;
- `docs/modules/planning.core/PLANNING_GANTT_FEATURE_CATALOG.md`.

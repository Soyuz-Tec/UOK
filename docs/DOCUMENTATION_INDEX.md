# UOK Documentation Index

**Status:** Active documentation routing map.

**Current candidate:** `UOK-3.1.0-alpha.3`

This index explains which Markdown artifact owns each kind of UOK knowledge. It exists so future development can continue from accepted policies and verified lessons instead of rediscovering or rewriting the same guidance.

The architecture entry point remains `docs/ARCHITECTURE.md`. This index is the navigation layer for policies, decisions, module plans, research records, and verification evidence.

Planning Gate A local/runtime closure is verified under `docs/architecture/ADR-0003-planning-gate-a-stabilization.md`; evidence maturity, verification results, and the boundary to hosted CI/review and later production hardening are tracked in `docs/modules/planning.core/PLANNING_GANTT_IMPLEMENTATION_TRACEABILITY.md`.

## Reading Order For New Work

Before non-trivial implementation, read these in order:

1. `AGENTS.md` when work is performed by Codex or another coding agent
2. `README.md`
3. `docs/ARCHITECTURE.md`
4. `docs/architecture/UOK_DEVELOPMENT_CONTINUITY_SYSTEM.md`
5. The active policy documents affected by the task
6. The module plan under `docs/modules/<module-name>/` when the task touches a module
7. The nearest module `README.md` under `modules/<module-name>/`

Tests, live runtime behavior, Git state, and module manifests remain stronger than older notes or chat history.

## Authority Map

| Artifact | Owns | Update when |
|---|---|---|
| `AGENTS.md` | Repo-local Codex working agreements and required preflight checks | Agent workflow, mandatory local checks, or repository-specific coding rules change |
| `README.md` | Quick project entry, local run path, verification summary | Version, startup, login, or headline discipline changes |
| `modules/README.md` | Module package shape and current module catalog | Module inventory, physical package shape, or module discoverability changes |
| `web/README.md` | Product-neutral shell ownership and module frontend composition entry point | Shell/module frontend boundary, generated catalog, or frontend verification path changes |
| `docs/ARCHITECTURE.md` | Top-level architecture, active candidate, system containers, boundaries, key decision links | Runtime units, boundaries, candidate identity, module model, or required gates change |
| `docs/DOCUMENTATION_INDEX.md` | Documentation routing and artifact ownership | New durable Markdown artifact is added or an artifact changes purpose |
| `docs/architecture/UOK_DEVELOPMENT_CONTINUITY_SYSTEM.md` | Development continuity process, feedback loop, documentation update rules | Workflow, quality gates, or continuity responsibilities change |
| `docs/architecture/UOK_INTERNAL_ENGINEERING_SYSTEM.md` | Internalized engineering system based on Microsoft SDL, Google Engineering Practices, SLSA, OpenSSF Scorecard, ISO, NIST, and OWASP standards | Policies, checklists, CI gates, code review rules, release gates, dashboards, or audit evidence change |
| `docs/architecture/UOK_AI_WORKER_DEVELOPMENT_MODEL.md` | Development-time AI worker roles, activation levels, handoff protocol, and verification authority | Coding-agent workflow, specialist review workers, worker handoff, or AI-assisted development governance changes |
| `docs/architecture/UOK_CODE_QUALITY_AND_TECHNOLOGY_AUDIT_STANDARD.md` | Code quality, line-of-code integrity, efficiency, source-size, and technology audit rules | Quality standards, technology audit gates, source-size policy, or reviewability rules change |
| `docs/operations/UOK_STANDARD_OPERATIONS.md` | Standard local operations, audits, GitHub preflight, backup, restore, rebuild, repeatable commands | Operations command, evidence, backup, restore, or GitHub workflow changes |
| `docs/operations/UOK_ASUH_TEST_EVENTS.md` | Local ASUH incident-drill schedule and event trigger rules | ASUH event types, local schedules, or incident drill expectations change |
| `docs/operations/UOK_GITHUB_ENGINEERING_GUARDRAILS.md` | GitHub-facing source-of-truth, ownership, dependency, Scorecard, branch-protection, and evidence controls | GitHub workflows, synchronization policy, CODEOWNERS, dependency monitoring, branch-protection expectations, or engineering evidence change |
| `docs/operations/UOK_DATABASE_CONNECTION_POOLING.md` | Application pool configuration, connection-capacity budgets, telemetry, recovery verification, and the PgBouncer activation boundary | Pool settings, worker/replica budget, database limits, recovery checks, or external-pooler decision changes |
| `docs/operations/UOK_PLANNING_SCALE_BUDGETS.md` | Repeatable Planning backend/browser budgets, profiles, evidence, and rollback-only fixture rules | Planning scale threshold, benchmark profile, virtualization trigger, or performance evidence changes |
| `docs/operations/UOK_PLANNING_RELEASE_READINESS.md` | Gate E production-like local health, candidate, scale, recovery, live-browser, and evidence profile | Planning release-readiness composition or evidence boundary changes |
| `docs/operations/UOK_CALENDAR_CORE_DEPLOYMENT.md` | Calendar Core deployment scope, controls, deferred adapters, and local verification boundary | Calendar deployment scope, security controls, adapter status, or verification changes |
| `docs/operations/UOK_CONTACTS_CORE_OPERATIONS.md` | Contacts verifier-group dry run, exact empty/legacy membership evidence, recoverable membership removal and archive, backup, verification, and rollback | Contacts verifier cleanup criteria, execution controls, backup, archive, evidence, or rollback changes |
| `docs/architecture/ADR-*` | Material architecture decisions | Boundary, runtime, data model, auth, deployment, framework, or major policy decisions change |
| `docs/architecture/ADR-0002-planning-gantt-and-ui-proof-dependencies.md` | Planning Gantt and UI proof dependency decision | Planning UI library, scheduling authority, or UI proof automation changes |
| `docs/architecture/ADR-0003-planning-gate-a-stabilization.md` | Planning Gate A scheduling-correctness, write-safety, and evidence-maturity decision | Gate A scope, sequencing, evidence states, or closure requirements change |
| `docs/architecture/ADR-0004-planning-typed-link-resolver.md` | Planning Gate B cross-module target identity, resolver state, authorization, lifecycle, and privacy boundary | Link target kind/provider, resolver behavior, disclosure policy, or ownership changes |
| `docs/architecture/ADR-0005-planning-date-semantics.md` | Planning planned/forecast/actual/deadline authority, project timezone, UTC storage, DST, variance, and subday-scale boundary | Date-family ownership, timezone conversion, correction policy, or time precision changes |
| `docs/architecture/ADR-0006-planning-task-participant-boundary.md` | Planning participant roles, canonical Party resolution, authorization, lifecycle, privacy, revision, and resource-separation boundary | Participant role, Party provider, disclosure, retention, or resource-correlation behavior changes |
| `docs/architecture/ADR-0007-planning-task-requirements-and-readiness.md` | Planning requirement workflow, gate authority, linked-evidence compatibility, provider fail-closed behavior, and derived readiness | Requirement types/states, approval authority, readiness, evidence links, or requirement lifecycle changes |
| `docs/architecture/ADR-0008-communications-thread-provider-boundary.md` | K Connect thread identity, authorization, lifecycle, Planning adapter, and exact deep-link boundary | Thread ownership, permissions, resolver states, deep links, or communications lifecycle changes |
| `docs/architecture/ADR-0009-planning-typed-resource-boundary.md` | Planning resource types, capacities, units, canonical references, effective dates, and participant separation | Resource type/unit, capacity, canonical-reference, effective-period, or ownership rules change |
| `docs/architecture/ADR-0010-planning-resource-capacity-calendars.md` | Planning resource weekdays, holidays, effective capacity, exceptions, validation, workload, and leveling boundary | Resource calendar, capacity precedence, exception, or leveling-availability rules change |
| `docs/architecture/ADR-0011-planning-resource-calendar-correlation.md` | Planning task/resource Party correlation to calendar events, privacy, warnings, and ETag behavior | Free/busy correlation, participant identity, warning scope, or calendar privacy rules change |
| `docs/architecture/ADR-0012-planning-explainable-resource-leveling.md` | Simple leveling strategy, configured horizon, explicit outcomes, reason codes, independent validation, and optimizer boundary | Leveling strategy, horizon, outcome, diagnostic, validation, or optimizer rules change |
| `docs/architecture/ADR-0013-planning-immutable-what-if-snapshots.md` | Immutable analysis source capture, temporary preview evaluation, checksums, permissions, and non-mutation boundary | What-if snapshot, analysis source, preview, integrity, or analysis permission rules change |
| `docs/architecture/ADR-0014-planning-reproducible-risk-analysis.md` | Seeded bounded Monte Carlo inputs, correlations, limits, percentiles, confidence, integrity, and reproduction contract | Risk engine, distribution, correlation, seed, simulation limit, percentile, or confidence rules change |
| `docs/architecture/ADR-0015-planning-governed-optimization-and-recommendations.md` | Bounded optimizer, dependency review, objectives, limits, explanations, approval/apply/audit/rollback lifecycle | Optimization engine, dependency, objective, limit, recommendation, approval, apply, audit, or rollback rules change |
| `docs/architecture/ADR-0016-planning-scale-budgets-and-virtualization.md` | Measured Planning budgets, rollback-only profiles, virtualization trigger/threshold, overscan, alignment, and accessibility metadata | Planning scale budget, fixture, threshold, virtual window, overscan, or scroll-alignment rules change |
| `docs/architecture/ADR-0017-uok-localization-bidirectional-and-touch-boundary.md` | Shared locale/direction ownership, fallback/formatting, RTL chronology isolation, touch targets, virtual focus, and reflow rules | Locale registry, translation owner, document direction, RTL layout, touch target, or virtual focus rules change |
| `docs/architecture/ADR-0018-planning-portfolio-and-release-readiness.md` | Actor-scoped bounded portfolio aggregate, explainable health, typed multi-project UI, diagnostics, and local release-readiness boundary | Portfolio scope/query model/health or production-like Planning gate composition changes |
| `docs/architecture/ADR-0019-planning-revision-ledger-and-transactional-outbox.md` | Immutable Planning revision history, exact source-command linkage, transactional outbox evidence, and no-dispatcher boundary | Revision ledger, outbox payload/schema, source linkage, history disclosure, or delivery boundary changes |
| `docs/architecture/ADR-0020-planning-project-lifecycle-and-finish-authority.md` | Controlled project lifecycle, archive/purge boundary, exact target commitment, persisted CPM finish, and quiesced migration contract | Project status, transition, finish authority, CPM compatibility, or lifecycle migration behavior changes |
| `docs/architecture/ADR-0021-module-manifest-runtime-and-release-truth.md` | Closed manifest schema/maturity, runtime-release validation split, module verifier ownership, and Apps Manager adapter boundary | Manifest schema, maturity, extension hooks, verifier discovery, or Apps Manager API ownership changes |
| `docs/architecture/ADR-0022-module-owned-orm-registration.md` | Single-Base kernel/module ORM ownership, deterministic registration, exact compatibility identity, and static-validation boundary | ORM ownership, model providers, registration order, metadata composition, or compatibility aliases change |
| `docs/architecture/ADR-0023-module-local-frontend-composition.md` | Module-local React/CSS/test ownership, closed-manifest frontend metadata, deterministic compile-time catalog generation, and transitional shell host boundary | Module frontend paths, surface metadata, catalog generation, shell composition, test discovery, or frontend container packaging changes |
| `docs/architecture/ADR-0024-database-connection-pooling.md` | Bounded process-local pooling, capacity enforcement, telemetry, and evidence-gated deferral of PgBouncer | Database pooling ownership, capacity formula, connection topology, or PgBouncer activation conditions change |
| `docs/architecture/ADR-0025-uniform-workspace-command-surface-and-action-vocabulary.md` | Minimal shared workspace command surface, common action vocabulary, and shared/module ownership split | Command grouping, shared labels, primary-action rules, low-frequency action placement, or exception policy changes |
| `docs/architecture/ADR-0026-calendar-integrity-and-appointments-boundary.md` | Calendar access, integrity, interoperability sequencing, and the separate appointments capability boundary | Calendar visibility, recurrence authority, free-busy disclosure, provider synchronization sequencing, or appointment ownership changes |
| `docs/architecture/ADR-0027-contacts-system-of-record-governance-and-interoperability.md` | Contacts system-of-record scope, first-class facts, consent, team access, purge, quality, and interoperability boundary | Contacts storage, privacy, authorization, import/export, dedupe, activity, custom fields, or provider adapter changes |
| `docs/architecture/UOK_MODULE_EXTENSION_CONTRACT.md` | Module shape, manifest contract, extension points, module acceptance | Module extension surfaces, manifest fields, or lifecycle rules change |
| `docs/architecture/UOK_MODULE_MANIFESTS_AND_BOUNDARIES.md` | Manifest validation and source-boundary scan expectations | Module loader, boundary checks, or source-boundary rules change |
| `docs/architecture/planning-data-boundary-inventory-2026-07-15.md` | Pre-refactor evidence of Planning reads across capability-module data boundaries | A correction is needed to the dated leak inventory or its audit method |
| `docs/architecture/planning-data-boundary-fix-2026-07-15.md` | Planning owner-API refactor mapping, enforcement command, verification, and residual risks | Planning's provider API boundary or enforcement evidence changes |
| `docs/architecture/UOK_MODULE_ROADMAP.md` | UOK-level module status and next boundary work | Module status, target, ownership, or roadmap changes |
| `docs/architecture/UOK_AI_OPERATIONS_KERNEL_ARCHITECTURE.md` | AI-operated business workflow architecture, governed agent tools, human approval gates, and compliance evidence model | Agent governance, Codex tool binding, AI workflow, approval, or evidence architecture changes |
| `docs/architecture/UOK_GLOBAL_EXPORT_ARTIFACTS.md` | Global export artifact boundary for CSV, JSON, image/SVG, PDF, document, and future import/export helpers | Export format ownership, shared artifact primitives, module export behavior, or export UI patterns change |
| `docs/architecture/UOK_GLOBAL_SHARED_FEATURES.md` | Module-neutral reusable backend and frontend feature boundaries | Shared UI primitive, backend helper, table behavior, event helper, or cross-module feature ownership changes |
| `docs/reports/SECURE_REPORTS_ARTIFACT_ENGINE.md` | Secure reports artifact generation, storage, audit, verification, download, and deletion boundary | Report artifact security, supported report formats, report API, or reports.core adapter direction changes |
| `docs/architecture/UOK_PROGRAMMING_LANGUAGE_STACK_POLICY.md` | Approved programming stack and maintainability rules | Runtime language, framework, dependency, source-size, or verification policy changes |
| `docs/design/UOK_UI_DESIGN_POLICY.md` | Mandatory UI design policy | UI system, layout, accessibility, appearance, or interaction rules change |
| `docs/design/UOK_LOCALIZATION_AND_BIDIRECTIONAL_POLICY.md` | Mandatory shared localization, bidirectional layout, formatting, touch, and representative verification policy | Locale, translation, direction, logical layout, formatter, touch, reflow, or localized evidence changes |
| `docs/design/UOK_WORKSPACE_UI_IMPLEMENTATION_STANDARD.md` | Workspace UI implementation method, specialist agent groups, reusable primitive promotion, and UI verification gates | UI implementation workflow, shared primitive rules, workspace anatomy, or specialist review responsibilities change |
| `docs/design/UOK_APPLE_HIG_TECHNICAL_REFERENCE.md` | Apple-informed technical UI reference | UI implementation guidance needs updated source detail |
| `docs/design/UOK_CONTACTS_WORKSPACE_MINIMAL_PHASES.md` | Contacts workspace phased UI target | Contacts workspace phase status or UI target changes |
| `docs/architecture/UOK_NAMING_CONVENTIONS.md` | Valid UOK naming forms and product-neutral naming rules | Naming policy, module naming, product code, or display label rules change |
| `docs/architecture/UOK_PRODUCT_CARGO_SEPARATION_POLICY.md` | Product, cargo, and transaction separation | Product/cargo/business module modeling changes |
| `docs/architecture/UOK_CONTACT_BUSINESS_INTELLIGENCE_PROFILES.md` | Contacts-derived intelligence profile guidance | Contact profile contract, derivation sources, or storage boundary changes |
| `docs/modules/agents.core/AGENTS_CORE_MODULE_PLAN.md` | Agents Core module roadmap and scope | Agent runbook, governed tool, approval, evidence, or module ownership changes |
| `docs/modules/calendar.core/CALENDAR_CORE_MODULE_PLAN.md` | Calendar Core module roadmap and scope | Calendar workspace, events, recurrence, reminders, availability, free/busy, or iCalendar behavior changes |
| `docs/modules/communications.core/COMMUNICATIONS_CORE_MODULE_PLAN.md` | Communications Core thread-provider roadmap and scope | K Connect thread identity, access, lifecycle, UI, or Planning integration changes |
| `docs/modules/contacts.core/CONTACTS_APP_PLAN.md` | Contacts module roadmap and scope | Contacts behavior, workflows, module ownership, or acceptance changes |
| `docs/modules/planning.core/PLANNING_CORE_MODULE_PLAN.md` | Planning Core module roadmap and scope | Gantt, scheduling, dependency, project, baseline, calendar, or planning verification behavior changes |
| `docs/modules/planning.core/PLANNING_GANTT_FEATURE_CATALOG.md` | Planning Gantt feature inventory and evidence maturity | Gantt grid, timeline, scheduling, dependency, resource, baseline, color, workspace feature, or maturity evidence changes |
| `docs/modules/planning.core/PLANNING_GANTT_IMPLEMENTATION_TRACEABILITY.md` | Gates A-E and architecture requirement-to-evidence map, closure status, and production-hardening boundary | A requirement, evidence link, verification result, maturity state, architecture closure, or residual hardening item changes |
| `docs/modules/planning.core/PLANNING_GANTT_EXTERNAL_FEATURE_INTAKE.md` | DHTMLX/SVAR-inspired Gantt research and UOK intake disposition | External Gantt research or adopted/partial/deferred/global-boundary disposition changes; evidence maturity remains in the catalog and traceability map |
| `modules/<module-name>/**/README.md` | Module-local implementation ownership | Module package layout, test ownership, migration ownership, or web ownership changes |
| `docs/architecture/UOK_OPEN_SOURCE_ERP_QUALITY_RATING_CHART.md` | Peer quality comparison snapshot | Peer comparison or scoring basis changes |
| `docs/architecture/UOK_PEER_CODE_FOLDER_STRUCTURE_COMPARISON.md` | Peer folder-structure comparison | Folder-structure comparison or peer scope changes |
| `docs/architecture/RC9_REFERENCE_TARGET.md` | Historical RC9 hardening reference | Do not update for current facts unless preserving historical context requires clarification |

## Artifact Classes

### Active Policies

Active policies are mandatory until replaced through an ADR or explicit policy update:

- `docs/architecture/UOK_PROGRAMMING_LANGUAGE_STACK_POLICY.md`
- `docs/architecture/UOK_INTERNAL_ENGINEERING_SYSTEM.md`
- `docs/architecture/UOK_AI_WORKER_DEVELOPMENT_MODEL.md`
- `docs/architecture/UOK_CODE_QUALITY_AND_TECHNOLOGY_AUDIT_STANDARD.md`
- `docs/design/UOK_UI_DESIGN_POLICY.md`
- `docs/design/UOK_WORKSPACE_UI_IMPLEMENTATION_STANDARD.md`
- `docs/architecture/UOK_MODULE_EXTENSION_CONTRACT.md`
- `docs/architecture/UOK_NAMING_CONVENTIONS.md`
- `docs/architecture/UOK_PRODUCT_CARGO_SEPARATION_POLICY.md`
- `docs/architecture/UOK_DEVELOPMENT_CONTINUITY_SYSTEM.md`
- `docs/operations/UOK_STANDARD_OPERATIONS.md`
- `docs/operations/UOK_ASUH_TEST_EVENTS.md`
- `docs/operations/UOK_CALENDAR_CORE_DEPLOYMENT.md`
- `docs/operations/UOK_CONTACTS_CORE_OPERATIONS.md`
- `docs/operations/UOK_GITHUB_ENGINEERING_GUARDRAILS.md`
- `docs/operations/UOK_DATABASE_CONNECTION_POOLING.md`
- `docs/operations/UOK_PLANNING_SCALE_BUDGETS.md`

Implementation must either comply with these artifacts or update them through the policy-change process.

### Architecture Records

Architecture records describe current boundaries, module mechanics, and decisions:

- `docs/ARCHITECTURE.md`
- `docs/architecture/UOK_AI_OPERATIONS_KERNEL_ARCHITECTURE.md`
- `docs/architecture/UOK_AI_WORKER_DEVELOPMENT_MODEL.md`
- `docs/architecture/ADR-0001-module-extension-runtime-boundaries.md`
- `docs/architecture/ADR-0002-planning-gantt-and-ui-proof-dependencies.md`
- `docs/architecture/ADR-0003-planning-gate-a-stabilization.md`
- `docs/architecture/ADR-0004-planning-typed-link-resolver.md`
- `docs/architecture/ADR-0005-planning-date-semantics.md`
- `docs/architecture/ADR-0006-planning-task-participant-boundary.md`
- `docs/architecture/ADR-0007-planning-task-requirements-and-readiness.md`
- `docs/architecture/ADR-0008-communications-thread-provider-boundary.md`
- `docs/architecture/ADR-0009-planning-typed-resource-boundary.md`
- `docs/architecture/ADR-0010-planning-resource-capacity-calendars.md`
- `docs/architecture/ADR-0011-planning-resource-calendar-correlation.md`
- `docs/architecture/ADR-0012-planning-explainable-resource-leveling.md`
- `docs/architecture/ADR-0013-planning-immutable-what-if-snapshots.md`
- `docs/architecture/ADR-0014-planning-reproducible-risk-analysis.md`
- `docs/architecture/ADR-0015-planning-governed-optimization-and-recommendations.md`
- `docs/architecture/ADR-0016-planning-scale-budgets-and-virtualization.md`
- `docs/architecture/ADR-0017-uok-localization-bidirectional-and-touch-boundary.md`
- `docs/architecture/ADR-0018-planning-portfolio-and-release-readiness.md`
- `docs/architecture/ADR-0019-planning-revision-ledger-and-transactional-outbox.md`
- `docs/architecture/ADR-0020-planning-project-lifecycle-and-finish-authority.md`
- `docs/architecture/ADR-0021-module-manifest-runtime-and-release-truth.md`
- `docs/architecture/ADR-0022-module-owned-orm-registration.md`
- `docs/architecture/ADR-0023-module-local-frontend-composition.md`
- `docs/architecture/ADR-0024-database-connection-pooling.md`
- `docs/architecture/ADR-0025-uniform-workspace-command-surface-and-action-vocabulary.md`
- `docs/architecture/ADR-0026-calendar-integrity-and-appointments-boundary.md`
- `docs/architecture/ADR-0027-contacts-system-of-record-governance-and-interoperability.md`
- `docs/architecture/UOK_MODULE_MANIFESTS_AND_BOUNDARIES.md`
- `docs/architecture/planning-data-boundary-inventory-2026-07-15.md`
- `docs/architecture/planning-data-boundary-fix-2026-07-15.md`
- `docs/architecture/UOK_MODULE_ROADMAP.md`
- `docs/architecture/UOK_GLOBAL_EXPORT_ARTIFACTS.md`
- `docs/architecture/UOK_GLOBAL_SHARED_FEATURES.md`
- `docs/design/UOK_LOCALIZATION_AND_BIDIRECTIONAL_POLICY.md`
- `docs/reports/SECURE_REPORTS_ARTIFACT_ENGINE.md`

These documents must not overstate future plans as current behavior.

### Module Plans

Module plans live under `docs/modules/<module-name>/`.

The current active module plans are:

- `docs/modules/agents.core/AGENTS_CORE_MODULE_PLAN.md`
- `docs/modules/calendar.core/CALENDAR_CORE_MODULE_PLAN.md`
- `docs/modules/communications.core/COMMUNICATIONS_CORE_MODULE_PLAN.md`
- `docs/modules/contacts.core/CONTACTS_APP_PLAN.md`
- `docs/modules/planning.core/PLANNING_CORE_MODULE_PLAN.md`

Module plans should describe module-owned behavior, workflows, acceptance checks, and open next work. They should not redefine UOK-level architecture unless they link to the relevant architecture document.

### Design Records

Design records govern UI direction and interaction quality:

- `docs/design/UOK_UI_DESIGN_POLICY.md`
- `docs/design/UOK_WORKSPACE_UI_IMPLEMENTATION_STANDARD.md`
- `docs/design/UOK_APPLE_HIG_TECHNICAL_REFERENCE.md`
- `docs/design/UOK_CONTACTS_WORKSPACE_MINIMAL_PHASES.md`

UI changes must be checked against these documents before being considered complete.

### Research And Comparison Records

Research records inform decisions but are not automatically mandatory policy:

- `docs/architecture/UOK_OPEN_SOURCE_ERP_QUALITY_RATING_CHART.md`
- `docs/architecture/UOK_PEER_CODE_FOLDER_STRUCTURE_COMPARISON.md`
- `docs/architecture/RC9_REFERENCE_TARGET.md`

If a research finding becomes mandatory, promote it into an active policy, module plan, or ADR.

### Operations Records

Operations records define repeatable local work:

- `docs/operations/UOK_STANDARD_OPERATIONS.md`
- `docs/operations/UOK_ASUH_TEST_EVENTS.md`

Operations records may reference local evidence under `var/`, but local evidence must stay out of Git unless explicitly promoted into a sanitized documentation artifact.

## Markdown Update Rules

- Add or update Markdown in the same change set as the code when behavior, boundaries, workflow, UI policy, language policy, or verification gates change.
- Keep docs short enough to be reviewable. Prefer a focused new artifact over appending unrelated rules to an existing file.
- Every new durable Markdown artifact must include `Status`, current target or candidate, purpose, scope, and validation guidance when applicable.
- Use only accepted UOK naming forms from `docs/architecture/UOK_NAMING_CONVENTIONS.md`.
- Do not let historical target documents become current policy by accident.
- Link new documents from this index and from `docs/ARCHITECTURE.md` when they affect architecture or mandatory development workflow.

## Verification For Documentation Changes

Documentation changes must pass the same naming and consistency checks as code changes when they touch active policy:

```powershell
python scripts/quality_audit.py
python scripts/run_python_tests.py
python -m pytest tests/test_naming_policy.py -q
```

When a documentation change also affects runtime behavior, run the full candidate gate from `docs/ARCHITECTURE.md`.

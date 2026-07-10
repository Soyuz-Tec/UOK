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
| `docs/ARCHITECTURE.md` | Top-level architecture, active candidate, system containers, boundaries, key decision links | Runtime units, boundaries, candidate identity, module model, or required gates change |
| `docs/DOCUMENTATION_INDEX.md` | Documentation routing and artifact ownership | New durable Markdown artifact is added or an artifact changes purpose |
| `docs/architecture/UOK_DEVELOPMENT_CONTINUITY_SYSTEM.md` | Development continuity process, feedback loop, documentation update rules | Workflow, quality gates, or continuity responsibilities change |
| `docs/architecture/UOK_INTERNAL_ENGINEERING_SYSTEM.md` | Internalized engineering system based on Microsoft SDL, Google Engineering Practices, SLSA, OpenSSF Scorecard, ISO, NIST, and OWASP standards | Policies, checklists, CI gates, code review rules, release gates, dashboards, or audit evidence change |
| `docs/architecture/UOK_AI_WORKER_DEVELOPMENT_MODEL.md` | Development-time AI worker roles, activation levels, handoff protocol, and verification authority | Coding-agent workflow, specialist review workers, worker handoff, or AI-assisted development governance changes |
| `docs/architecture/UOK_CODE_QUALITY_AND_TECHNOLOGY_AUDIT_STANDARD.md` | Code quality, line-of-code integrity, efficiency, source-size, and technology audit rules | Quality standards, technology audit gates, source-size policy, or reviewability rules change |
| `docs/operations/UOK_STANDARD_OPERATIONS.md` | Standard local operations, audits, GitHub preflight, backup, restore, rebuild, repeatable commands | Operations command, evidence, backup, restore, or GitHub workflow changes |
| `docs/operations/UOK_ASUH_TEST_EVENTS.md` | Local ASUH incident-drill schedule and event trigger rules | ASUH event types, local schedules, or incident drill expectations change |
| `docs/operations/UOK_GITHUB_ENGINEERING_GUARDRAILS.md` | GitHub-facing source-of-truth, ownership, dependency, Scorecard, branch-protection, and evidence controls | GitHub workflows, synchronization policy, CODEOWNERS, dependency monitoring, branch-protection expectations, or engineering evidence change |
| `docs/architecture/ADR-*` | Material architecture decisions | Boundary, runtime, data model, auth, deployment, framework, or major policy decisions change |
| `docs/architecture/ADR-0002-planning-gantt-and-ui-proof-dependencies.md` | Planning Gantt and UI proof dependency decision | Planning UI library, scheduling authority, or UI proof automation changes |
| `docs/architecture/ADR-0003-planning-gate-a-stabilization.md` | Planning Gate A scheduling-correctness, write-safety, and evidence-maturity decision | Gate A scope, sequencing, evidence states, or closure requirements change |
| `docs/architecture/ADR-0004-planning-typed-link-resolver.md` | Planning Gate B cross-module target identity, resolver state, authorization, lifecycle, and privacy boundary | Link target kind/provider, resolver behavior, disclosure policy, or ownership changes |
| `docs/architecture/ADR-0005-planning-date-semantics.md` | Planning planned/forecast/actual/deadline authority, project timezone, UTC storage, DST, variance, and subday-scale boundary | Date-family ownership, timezone conversion, correction policy, or time precision changes |
| `docs/architecture/ADR-0006-planning-task-participant-boundary.md` | Planning participant roles, canonical Party resolution, authorization, lifecycle, privacy, revision, and resource-separation boundary | Participant role, Party provider, disclosure, retention, or resource-correlation behavior changes |
| `docs/architecture/ADR-0007-planning-task-requirements-and-readiness.md` | Planning requirement workflow, gate authority, linked-evidence compatibility, provider fail-closed behavior, and derived readiness | Requirement types/states, approval authority, readiness, evidence links, or requirement lifecycle changes |
| `docs/architecture/UOK_MODULE_EXTENSION_CONTRACT.md` | Module shape, manifest contract, extension points, module acceptance | Module extension surfaces, manifest fields, or lifecycle rules change |
| `docs/architecture/UOK_MODULE_MANIFESTS_AND_BOUNDARIES.md` | Manifest validation and source-boundary scan expectations | Module loader, boundary checks, or source-boundary rules change |
| `docs/architecture/UOK_MODULE_ROADMAP.md` | UOK-level module status and next boundary work | Module status, target, ownership, or roadmap changes |
| `docs/architecture/UOK_AI_OPERATIONS_KERNEL_ARCHITECTURE.md` | AI-operated business workflow architecture, governed agent tools, human approval gates, and compliance evidence model | Agent governance, Codex tool binding, AI workflow, approval, or evidence architecture changes |
| `docs/architecture/UOK_GLOBAL_EXPORT_ARTIFACTS.md` | Global export artifact boundary for CSV, JSON, image/SVG, PDF, document, and future import/export helpers | Export format ownership, shared artifact primitives, module export behavior, or export UI patterns change |
| `docs/architecture/UOK_GLOBAL_SHARED_FEATURES.md` | Module-neutral reusable backend and frontend feature boundaries | Shared UI primitive, backend helper, table behavior, event helper, or cross-module feature ownership changes |
| `docs/reports/SECURE_REPORTS_ARTIFACT_ENGINE.md` | Secure reports artifact generation, storage, audit, verification, download, and deletion boundary | Report artifact security, supported report formats, report API, or reports.core adapter direction changes |
| `docs/architecture/UOK_PROGRAMMING_LANGUAGE_STACK_POLICY.md` | Approved programming stack and maintainability rules | Runtime language, framework, dependency, source-size, or verification policy changes |
| `docs/design/UOK_UI_DESIGN_POLICY.md` | Mandatory UI design policy | UI system, layout, accessibility, appearance, or interaction rules change |
| `docs/design/UOK_WORKSPACE_UI_IMPLEMENTATION_STANDARD.md` | Workspace UI implementation method, specialist agent groups, reusable primitive promotion, and UI verification gates | UI implementation workflow, shared primitive rules, workspace anatomy, or specialist review responsibilities change |
| `docs/design/UOK_APPLE_HIG_TECHNICAL_REFERENCE.md` | Apple-informed technical UI reference | UI implementation guidance needs updated source detail |
| `docs/design/UOK_CONTACTS_WORKSPACE_MINIMAL_PHASES.md` | Contacts workspace phased UI target | Contacts workspace phase status or UI target changes |
| `docs/architecture/UOK_NAMING_CONVENTIONS.md` | Valid UOK naming forms and product-neutral naming rules | Naming policy, module naming, product code, or display label rules change |
| `docs/architecture/UOK_PRODUCT_CARGO_SEPARATION_POLICY.md` | Product, cargo, and transaction separation | Product/cargo/business module modeling changes |
| `docs/architecture/UOK_CONTACT_BUSINESS_INTELLIGENCE_PROFILES.md` | Contacts-derived intelligence profile guidance | Contact profile contract, derivation sources, or storage boundary changes |
| `docs/modules/agents.core/AGENTS_CORE_MODULE_PLAN.md` | Agents Core module roadmap and scope | Agent runbook, governed tool, approval, evidence, or module ownership changes |
| `docs/modules/calendar.core/CALENDAR_CORE_MODULE_PLAN.md` | Calendar Core module roadmap and scope | Calendar workspace, events, recurrence, reminders, availability, free/busy, or iCalendar behavior changes |
| `docs/modules/contacts.core/CONTACTS_APP_PLAN.md` | Contacts module roadmap and scope | Contacts behavior, workflows, module ownership, or acceptance changes |
| `docs/modules/planning.core/PLANNING_CORE_MODULE_PLAN.md` | Planning Core module roadmap and scope | Gantt, scheduling, dependency, project, baseline, calendar, or planning verification behavior changes |
| `docs/modules/planning.core/PLANNING_GANTT_FEATURE_CATALOG.md` | Planning Gantt feature inventory and implementation status | Gantt grid, timeline, scheduling, dependency, resource, baseline, color, or workspace feature status changes |
| `docs/modules/planning.core/PLANNING_GANTT_IMPLEMENTATION_TRACEABILITY.md` | Gate A requirement-to-evidence map and closure status | A Gate A requirement, evidence link, verification result, or maturity state changes |
| `docs/modules/planning.core/PLANNING_GANTT_EXTERNAL_FEATURE_INTAKE.md` | DHTMLX/SVAR-inspired Gantt feature intake and UOK implementation mapping | External Gantt feature research is added, promoted, or reprioritized for planning.core |
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
- `docs/operations/UOK_GITHUB_ENGINEERING_GUARDRAILS.md`

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
- `docs/architecture/UOK_MODULE_MANIFESTS_AND_BOUNDARIES.md`
- `docs/architecture/UOK_MODULE_ROADMAP.md`
- `docs/architecture/UOK_GLOBAL_EXPORT_ARTIFACTS.md`
- `docs/architecture/UOK_GLOBAL_SHARED_FEATURES.md`
- `docs/reports/SECURE_REPORTS_ARTIFACT_ENGINE.md`

These documents must not overstate future plans as current behavior.

### Module Plans

Module plans live under `docs/modules/<module-name>/`.

The current active module plans are:

- `docs/modules/agents.core/AGENTS_CORE_MODULE_PLAN.md`
- `docs/modules/calendar.core/CALENDAR_CORE_MODULE_PLAN.md`
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
python -m pytest -q
python -m pytest tests/test_naming_policy.py -q
```

When a documentation change also affects runtime behavior, run the full candidate gate from `docs/ARCHITECTURE.md`.

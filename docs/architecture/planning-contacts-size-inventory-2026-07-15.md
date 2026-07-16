# Planning And Contacts Size Inventory – 2026-07-15

**Status:** Pre-refactor public-surface and size inventory.

**Current candidate:** `UOK-3.1.0-alpha.3`

## Purpose

Record the actual public entry points, external callers, internal capabilities,
size signals, data ownership, and evidence-based split decision for
`planning.core` and `contacts.core` before the focused Gap 2 refactor. This
inventory is based on branch `feature/planning-flow-board` at commit
`620ffe9d84c1b7f3977b0e071936fbb97dbab090`.

## Scope And Counting Method

Production size counts Python below each module backend plus TypeScript, TSX,
and CSS below each module `web/src`. LOC is approximate nonblank source LOC.
Tests, migrations, verifier scripts, generated files, and documentation are
reported separately. Capability totals assign cross-cutting files to their
dominant responsibility so every production file is counted exactly once.

Public-surface counts distinguish:

- supported package/facade symbols;
- syntactically importable non-private declarations and explicit `__all__`
  names in the current flat Python packages;
- manifest-only composition/bootstrap hooks;
- HTTP and command contracts, which remain unchanged because removing them
  would change behavior;
- frontend exports versus the entries actually imported outside their owner.

## A. Public API Inventory

| Module | Public entry (file/symbol) | Callers (other modules / frontend) | Should stay public? (Y/N) | If N → move to internal |
|---|---|---|:---:|---|
| Planning | `modules/planning.core/manifest.yaml:90` → `uok_planning_core.api:router` | Runtime composition through `src/uok/module_routers.py`; Planning-owned HTTP clients consume the 44 routes. | Y | Expose only the composed router through `uok_planning_core.public_api`; route handlers, schemas, and subrouters become internal. |
| Planning | `uok_planning_core.analysis_api:router`, `portfolio_api:router`, `resource_calendar_api:router`, and `revision_api:router` | Only the former flat Planning router aggregator, now at `modules/planning.core/backend/uok_planning_core/_internal/delivery/api.py`. | N | Planning internal analysis, portfolio, resources, and audit/delivery packages. |
| Planning | `uok_planning_core.commands::{command_handlers, command_permissions}` declared at `modules/planning.core/manifest.yaml:91-92` | Runtime command composition through `src/uok/module_commands.py`; 30 declared commands. | Y | Keep only the two provider functions on `public_api`; all concrete handlers become internal. |
| Planning | `uok_planning_core.replay_visibility:assert_planning_replay_visible` at `manifest.yaml:93` | Runtime exact-replay guard. | Y | Re-export through `public_api`; implementation stays internal. |
| Planning | `uok_planning_core.policy:role_grants` at `manifest.yaml:94` | Runtime permission composition through `src/uok/module_policy.py`. | Y | Re-export through `public_api`; grant data stays internal. |
| Planning | `uok_planning_core.reports::{dashboard_counts, evidence}` at `manifest.yaml:95-96` | Runtime dashboard and evidence composition through `src/uok/module_reports.py`. | Y | Re-export only these two provider functions through `public_api`. |
| Planning | `uok_planning_core.models:owned_models` at `manifest.yaml:97`, plus 18 ORM/helper names in that module's `__all__` | Privileged ORM registration through `src/uok/module_model_registry.py`; compatibility-only assertions in `tests/test_module_model_registry.py`. | N | Manifest-resolved internal persistence/bootstrap SPI. It must not appear in the business `public_api` because it returns ORM mappings. |
| Planning | Four direct imports in `scripts/planning_scale_benchmark.py:25-28`: batch command, schedule read model, schedule validation, and default calendar | Planning release operation and its module-owned benchmark test. | N | Move the benchmark implementation below Planning's verifier ownership; do not promote its four implementation dependencies. |
| Planning | The remaining 202 explicit Python `__all__` names / 342 non-private declarations in the flat backend package | Planning implementation and owner-local tests only. No sibling capability module imports them. | N | Enforced Planning `_internal` capability packages. |
| Planning | `modules/planning.core/web/src/moduleSurface.tsx::{planningModuleSurface, default}` | Generated compile-time catalog at `web/src/generated/moduleSurfaceCatalog.ts:8`. | Y | Keep as the sole externally importable Planning frontend entry. |
| Planning | Remaining 438 TypeScript/TSX export declarations | Planning implementation and owner-local frontend tests only. | N | Keep module-owned and reject external deep imports; physical frontend re-foldering is unnecessary behavior-neutral churn in this slice. |
| Contacts | `modules/contacts.core/backend/uok_contacts_core/public_api.py::{PartyReferenceResolution, resolve_party_reference}` | Planning only, now at `modules/planning.core/backend/uok_planning_core/_internal/coordination/link_resolver.py`. | Y | Keep as the canonical actor-authorized immutable Party-reference query. |
| Contacts | `modules/contacts.core/manifest.yaml:106` → `uok_contacts_core.api:router` | Runtime route composition plus Contacts, shell, Planning selector, and cleanup HTTP consumers; 57 HTTP operations. | Y | Expose only the composed router through `public_api`; route handlers and request schemas become internal. |
| Contacts | `uok_contacts_core.commands::{command_handlers, command_permissions}` at `manifest.yaml:107-108` | Runtime command composition; 37 declared commands. | Y | Keep only the two provider functions on `public_api`; concrete handlers become internal. |
| Contacts | `uok_contacts_core.policy:role_grants` and `reports::{dashboard_counts, evidence}` at `manifest.yaml:109-111` | Runtime permission, dashboard, and evidence composition. | Y | Re-export only these three provider functions through `public_api`. |
| Contacts | `uok_contacts_core.models:owned_models` at `manifest.yaml:112`, plus 18 ORM/helper names in `models.__all__` | Privileged model registry; compatibility-only model identity tests and test fixture setup. | N | Manifest-resolved internal persistence/bootstrap SPI only; never export through `public_api`. |
| Contacts | Package-root lazy facade plus `uok_contacts_core.facade.__all__` | Sixty-five symbols: 42 functions and 23 constants. Its only production bridge is the legacy kernel compatibility layer; no capability module needs it after Gap 1. | N | Remove root/star exports and retire unused kernel compatibility shims; owner-local users import internal packages. |
| Contacts | The former kernel `contact_access`, `contact_command_support`, `contact_duplicates`, `contact_import_commands`, `contact_read_model`, `contact_validation`, and `contacts_commands` shims | No production callers outside the compatibility files themselves; current tests explicitly allow them. | N | Retire the shims rather than adding their implementation details to the owner public API. |
| Contacts | Eight Contacts request classes formerly re-exported through a kernel Contact-schema shim, `src/uok/api/schemas.py`, and `src/uok/main.py` | No repository production caller; the Contacts router consumes its owner schemas directly. | N | Keep request schemas in the Contacts internal delivery package and remove kernel re-exports. |
| Contacts | `modules/contacts.core/web/src/moduleSurface.tsx::{contactsModuleSurface, default}` | Generated catalog plus the transitional shell bridge. | Y | Keep as the single Contacts frontend facade and re-export only the three shell-required bridge symbols from it. |
| Contacts | `CONTACTS_MODULE_ID`, `useContactCommands`, and `useContactWorkspaceState` from three deep module paths | `web/src/app/useWorkbenchData.ts` and `web/src/app/useWorkbench.ts`. | N as deep paths | Route the same three values through `moduleSurface.tsx`. This changes import discipline only and does not address the Gap 3 shell-state cycle. |
| Contacts | Candidate verifier `Invoke-UokContactsCandidateScenario` | Manifest-driven release verification. | Y | Keep as a separate module-owned verification entry, not a Python business API. |

## B. Internal Capability Map

### Planning

1. **Schedule authority and task workflow** — projects, tasks, dependencies,
   working calendars, date/status policy, CPM, baselines, Gantt and workspace.
2. **Resource planning and availability** — resource identity, capacity
   calendars, assignments, workload validation, and explainable leveling.
3. **Coordination and readiness** — typed links, Party participants, task
   requirements, Calendar correlation, and actor-safe provider resolution.
4. **Scenario analysis and optimization** — immutable what-if snapshots,
   reproducible risk, optimizer runs, recommendations, apply, and rollback.
5. **Portfolio, audit, and revision evidence** — bounded portfolio reads,
   revision history, outbox evidence, dashboard/evidence providers, and replay.

### Contacts

1. **Party registry and profile** — canonical Party identity, notes, facts,
   validation, profiles, search/read models, and list/detail/form/table UI.
2. **Groups and relationships** — manual/generated groups, exact membership,
   Party relationships, Groups Manager, and relationship productivity.
3. **Governance and system-of-record controls** — access, privacy, consent,
   teams, activity, saved views, external identities, and custom fields.
4. **Exchange, import, and quality** — CSV/vCard exchange, durable imports,
   dedupe/merge/rollback, persisted quality candidates, and data tools.
5. **Delivery and module composition** — HTTP/command adapters, schemas,
   policy/report providers, module surface, and compatibility boundary.

## C. Size Signals And Capability Verdicts

### Module Totals

| Module | Production files / LOC | Tests | Migrations | Verification | Public surface before refactor | Tables / schemas owned |
|---|---:|---:|---:|---:|---|---|
| Planning | 215 / 20,225 (74 backend; 141 web) | 112 / 10,949 LOC | 15 / 869 LOC | 20 / 1,881 LOC | No canonical backend facade; 202 explicit `__all__` names, 342 non-private Python declarations, 438 frontend exports, 44 HTTP routes, 30 commands | 17 ORM mappings; request/read DTO schemas remain module-owned |
| Contacts | 123 / 13,761 (49 backend; 74 web) | 37 / 3,921 LOC | 4 / 330 LOC | 3 / 336 LOC | 65-symbol root facade plus Gap 1 DTO API and compatibility/provider exports; 57 HTTP operations, 37 commands, 19 Pydantic request schemas | 17 ORM mappings plus shared CommandLog/EventRecord slices |

### Planning Capability Sizing

| Capability | Approx files / LOC | Tables primarily owned | Verdict |
|---|---:|---|---|
| Schedule authority and task workflow | 156 / 14,520 | `PlanningProject`, `PlanningTask`, `PlanningTaskDependency`, `PlanningCalendar`, `PlanningBaseline`, `PlanningScheduleEvent` | **Extract as internal package**; remains the Planning aggregate core. |
| Resource planning and availability | 20 / 1,463 | `PlanningResource`, `PlanningResourceCalendar`, `PlanningAssignment` | **Extract as internal package**; do not promote yet because it reads and mutates core task schedules. |
| Coordination and readiness | 10 / 887 | `PlanningLink`, `PlanningTaskParticipant`, `PlanningTaskRequirement` | **Extract as internal package**; ownership is project/task scoped. |
| Scenario analysis and optimization | 12 / 1,621 | `PlanningWhatIfSnapshot`, `PlanningAnalysisRun`, `PlanningAnalysisRecommendation` | **Extract as internal package**; do not promote because apply/rollback mutates the authoritative schedule. |
| Portfolio, audit, and revision evidence | 17 / 1,734 | `PlanningScheduleRevision`, `PlanningOutboxEvent`; portfolio is derived | **Extract as internal package**; retain same-transaction evidence ownership. |

The 15 migrations add 334, 79, 101, 164, and 191 LOC respectively to those
five groups.

### Contacts Capability Sizing

| Capability | Approx files / LOC | Tables primarily owned | Verdict |
|---|---:|---|---|
| Party registry and profile | 31 / 3,140 | `Party`, `PartyNote`, `PartyFact` | **Extract as internal package**; this is Contacts' defining authority. |
| Groups and relationships | 23 / 2,824 | `ContactGroup`, `ContactGroupMember`, `PartyRelationship` | **Extract as internal package**; do not promote because membership and relationships require Party authorization. |
| Governance and system-of-record controls | 15 / 1,689 | Consent, team/member, saved-view, activity, identity, custom-field/value tables | **Extract as internal package**; this is Contacts' privacy/access authority. |
| Exchange, import, and quality | 22 / 3,353 | `ContactImportBatch`, `ContactImportRow`, `ContactDuplicateCandidate` | **Extract as internal package**; do not promote because imports, merge, purge, consent, and rollback are one governed Party transaction. |
| Delivery and module composition | 32 / 2,755 | None | **Extract as internal delivery package**; retain only facade, manifest, and verifier entries. |

### Split Decision

**No new module is justified in this refactor.** Planning Resources and Analysis
have distinct vocabulary and tables, but both directly read or mutate core
Planning project/task schedule state. A physical split now would require either
foreign ORM access or an oversized schedule-mutation port. Contacts Groups,
Governance, and Exchange/Quality likewise have tables, but their foreign keys,
authorization, consent, purge, merge, and rollback semantics are deliberately
Party-scoped and transactional. None has an independent external client or a
stable autonomous data authority. Internal packages are the correct current
boundary; promotion requires stable DTO/query and governed mutation ports
first.

## D. Proposed Target Structure (Folders Only)

```text
modules/planning.core/
  backend/
    uok_planning_core/
      public_api.py
      _internal/
        delivery/
        scheduling/
        coordination/
        resources/
        analysis/
        portfolio_audit/
        persistence/
  web/
    src/
      moduleSurface.tsx
      # all other module-local source is private by enforced import policy
  migrations/
  tests/
  verify/
    runtime/

modules/contacts.core/
  backend/
    uok_contacts_core/
      public_api.py
      _internal/
        delivery/
        registry/
        groups_relationships/
        governance/
        exchange_quality/
        persistence/
  web/
    src/
      moduleSurface.tsx
      # all other module-local source is private by enforced import policy
  migrations/
  tests/
  verify/
```

The frontend shell-to-Contacts state/type cycle remains explicitly outside this
Gap 2 refactor. This target only replaces deep imports with the existing
module-surface facade; it does not redesign host services or move shell state.

## Validation Guidance

After implementation, run:

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
$env:UOK_BOOTSTRAP_ON_IMPORT='0'
python -m pytest -q -p no:cacheprovider tests/test_planning_data_boundary.py tests/test_module_public_api_boundaries.py
python scripts/run_python_tests.py
npm --prefix web test
npm --prefix web run build:static
```

The implementation and before/after verification record belong in
`docs/architecture/planning-contacts-size-fix-2026-07-15.md`.

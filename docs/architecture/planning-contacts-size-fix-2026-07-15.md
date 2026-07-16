# Planning And Contacts Size Fix – 2026-07-15

**Status:** Implemented, locally verified, and hosted Gap 2 CI green.

**Current candidate:** `UOK-3.1.0-alpha.3`

## Purpose

Record the focused Gap 2 refactor that narrowed the supported Planning and
Contacts surfaces, organized each implementation into cohesive private
capability packages, and added executable public-only dependency rules without
changing product behavior, UX, tenant/auth/audit rules, tables, commands,
events, or Gap 1 owner-DTO integrations. The pre-refactor evidence and counting
method are in
`docs/architecture/planning-contacts-size-inventory-2026-07-15.md`.

## 1. Before And After Public API Surface

| Module / surface | Before | After |
|---|---:|---:|
| Planning supported Python facade | No canonical facade; 202 explicit `__all__` names and 342 syntactically public declarations across a flat package | **7 exact symbols** in `modules/planning.core/backend/uok_planning_core/public_api.py`: 6 provider functions plus `api_router` |
| Contacts supported Python facade | 71 unique externally reachable functions/classes across compatibility surfaces; the largest was a separate 65-symbol facade (42 functions and 23 constants) | **8 exact symbols** in `modules/contacts.core/backend/uok_contacts_core/public_api.py`: 7 functions/classes plus `api_router` |
| Planning external frontend entry paths | 1 (`moduleSurface.tsx`) | **1** (`moduleSurface.tsx`) |
| Contacts external frontend entry paths | 4: the module surface plus 3 shell deep-import paths | **1**: `modules/contacts.core/web/src/moduleSurface.tsx` |
| Planning HTTP / command contracts | 44 routes / 30 commands | **44 / 30, unchanged** |
| Contacts HTTP / command contracts | 57 operations / 37 commands | **57 / 37, unchanged** |

The facade counts intentionally exclude the privileged manifest-only
`owned_models` providers. Those functions return ORM mappings to the validated
composition root and are not business APIs.

## 2. Internalized Versus Kept Public

### Planning

Kept public at
`modules/planning.core/backend/uok_planning_core/public_api.py`:

- `api_router`;
- `command_handlers` and `command_permissions`;
- `assert_planning_replay_visible`;
- `role_grants`;
- `dashboard_counts` and `evidence`.

All implementation code is now capability-organized below
`modules/planning.core/backend/uok_planning_core/_internal`:

- `delivery` — HTTP, command, transport schema, and policy adapters;
- `scheduling` — projects, tasks, calendars, CPM, baselines, and write safety;
- `coordination` — links, participants, requirements, and Calendar correlation;
- `resources` — typed resources, capacity calendars, and leveling;
- `analysis` — what-if, risk, optimization, and recommendations;
- `portfolio_audit` — portfolio, revisions, replay, dashboard, and evidence;
- `persistence` — all Planning ORM mappings and model registration.

The Planning scale benchmark moved from the shared script root to
`modules/planning.core/verify/runtime/planning_scale_benchmark.py`, so its
schedule and ORM implementation dependencies are owner-local.

### Contacts

Kept public at
`modules/contacts.core/backend/uok_contacts_core/public_api.py`:

- immutable `PartyReferenceResolution` and `resolve_party_reference`;
- `api_router`;
- `command_handlers` and `command_permissions`;
- `role_grants`;
- `dashboard_counts` and `evidence`.

All implementation code is now capability-organized below
`modules/contacts.core/backend/uok_contacts_core/_internal`:

- `delivery` — HTTP, commands, schemas, policy, reports, and internal facade;
- `registry` — Party access, facts, profiles, search, and validation;
- `groups_relationships` — groups, membership, reconciliation, and relations;
- `governance` — privacy, consent, teams, activity, and extensions;
- `exchange_quality` — import/export, dedupe, merge, rollback, and quality;
- `persistence` — all Contacts ORM mappings and model registration.

The broad package-root facade, the kernel `contact*` compatibility shims, the
kernel request-schema re-exports, and four Planning-specific kernel ORM aliases
were retired. `src/uok/models.py` remains the existing validated registry
compatibility surface; removing the kernel/host mix is Gap 3 and was not folded
into this change.

Frontend shell callers now import `CONTACTS_MODULE_ID`,
`useContactCommands`, and `useContactWorkspaceState` through
`modules/contacts.core/web/src/moduleSurface.tsx`. This is import-path
hardening only; it deliberately does not redesign the existing shell state
cycle.

## 3. Split Decision And Exact Boundaries

**Split: no.** No second module satisfies all three required tests: independent
data authority, a stable distinct public API, and sufficient autonomous
size/complexity.

Planning Resources and Analysis own distinct tables and vocabulary, but both
read or mutate the authoritative project/task schedule. Promoting either now
would require foreign ORM access or an oversized schedule-mutation port.
Contacts Groups, Governance, and Exchange/Quality own subordinate tables, but
authorization, consent, purge, merge, import, and rollback remain deliberately
Party-scoped and transactional. Internal capability packages are the correct
boundary; a future promotion requires stable DTO/query and governed mutation
ports plus an independently owned aggregate.

Data ownership is unchanged: Planning and Contacts retain their 17 ORM mappings
each, and no migration, table move, cross-module join, or shared-table expansion
occurred.

## 4. Enforcement, Test Commands, And CI Status

`tests/test_module_public_api_boundaries.py` now:

- rejects Python imports of either package root or `_internal` from outside its
  owner;
- permits only exact allowlisted symbols from each `public_api`;
- rejects star imports, unsupported facade members, and literal dynamic deep
  imports, including aliased `importlib` calls;
- blocks module-object facade imports and module-owned ORM backdoors through
  `uok.models` while preserving owner-local fixture access to the owner's own
  mappings;
- requires runtime manifest hooks to use the public facade while keeping ORM
  providers private;
- rejects external Planning/Contacts frontend deep imports other than
  `moduleSurface`, including callers in `web/e2e` and root web configuration;
- asserts exact facade symbol counts, exact non-private module namespaces, and
  the immutable Contacts DTO.

Focused architecture gate:

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
$env:UOK_BOOTSTRAP_ON_IMPORT='0'
python -m pytest -q -p no:cacheprovider tests/test_planning_data_boundary.py tests/test_module_public_api_boundaries.py
```

Repository Python sweep:

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
$env:UOK_BOOTSTRAP_ON_IMPORT='0'
python scripts/run_python_tests.py
```

Frontend behavior/build gates:

```powershell
npm --prefix web test
npm --prefix web run build:static
```

Current evidence:

- focused Gap 1 plus public-surface architecture tests: passed;
- Planning/Contacts manifest, model-registry, command-safety, and scale-smoke
  tests: passed;
- full isolated sequential Python sweep: **114 / 114 discovered test files
  passed**;
- frontend Vitest: **108 test files / 391 tests passed**;
- frontend static TypeScript/Vite build: passed;
- hosted Gap 2 CI for implementation commit
  `4b03a66505f2809f473f63c83617cb968236ca8f`: passed in both the push and
  pull-request runs:
  `https://github.com/Soyuz-Tec/UOK/actions/runs/29504806387` and
  `https://github.com/Soyuz-Tec/UOK/actions/runs/29504809396`;
- quality, generated-contract, module-release, container-asset, source-boundary,
  whitespace, and Python/frontend dependency audits: passed.

## 5. Gap 1 Remains Green

Confirmed by `tests/test_planning_data_boundary.py`: Planning production still
has zero foreign ORM/schema/repository reads and imports Contacts, Calendar,
Communications, and Reports only through their exact owner `public_api` DTO/query
surfaces. The current call sites are in
`modules/planning.core/backend/uok_planning_core/_internal/coordination/link_resolver.py`
and `calendar_bridge.py`. No DTO contains an ORM object, and no data ownership,
tenant, permission, lifecycle, or disclosure rule changed.

## 6. Residual Risks

1. Python privacy is enforced structurally and by AST rather than by a language
   visibility primitive. Non-literal reflective imports or raw filesystem
   loading require separate controls; no such caller was found.
2. The privileged manifest `model_exports` hooks remain internal ORM providers
   for one-process metadata composition. They are deliberately excluded from
   both business facades but remain extraction work if the process boundary
   changes.
3. The Contacts module surface still bridges shell-owned state and hooks. The
   import path is now singular, but the host/Contacts cycle itself is Gap 3.
4. Internal packaging improves cohesion and reviewability; it does not make the
   aggregate smaller in LOC. Promotion should wait for independent aggregate
   authority and stable ports rather than chasing file-count targets.
5. The quality audit still reports soft file-size warnings for three Contacts
   implementation files:
   `modules/contacts.core/backend/uok_contacts_core/_internal/delivery/commands.py`,
   `modules/contacts.core/backend/uok_contacts_core/_internal/governance/governance_commands.py`,
   and
   `modules/contacts.core/backend/uok_contacts_core/_internal/governance/privacy_commands.py`.
   It also reports a soft preferred-function-length warning for `parse_vcards`
   in `_internal/exchange_quality/contact_exchange.py`. These are owner-internal
   refactor candidates, not evidence for a new business module.

## 7. Ready For Gap 3?

**Yes.** Planning and Contacts now have small, executable public boundaries;
their implementations and ORM mappings are private; no speculative split was
introduced; and Gap 1 remains independently enforced. All local gates pass.
Gap 3 can therefore address the kernel/host mix and frontend shell–Contacts
cycle without reopening owner data access or broadening either facade. Both
hosted CI triggers passed before this handoff.

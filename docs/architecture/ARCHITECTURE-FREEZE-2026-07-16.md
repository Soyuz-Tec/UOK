# UOK Modular Monolith Architecture Freeze – 2026-07-16

**Status:** Active.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Effective baseline:** The Gap 1–3 structure verified in `docs/architecture/modular-monolith-structure-re-audit-2026-07-16.md`.

## Purpose

Freeze the current Good modular-monolith structure so the team can prioritize product, Party/MDM, intelligence, workflow, and reporting delivery without reopening settled boundaries or performing cosmetic modularization.

## Scope

This freeze governs `src/uok/host`, `src/uok/kernel`, product-neutral root platform code under `src/uok`, all `modules/*`, `web/src`, module-owned frontend source, manifests, migrations, public APIs, architecture tests, and CI gates.

## Freeze Rules

### 1. New code location

- Put FastAPI application creation, middleware/static wiring, engine/session/pool ownership, authentication transport, command dispatch, provider resolution, ORM registration, and runtime composition in `src/uok/host`.
- Put only stable feature-neutral ports/contracts and universal organization, identity, governance, lifecycle, command-log, workflow, or event mappings in `src/uok/kernel` and `src/uok/kernel_models.py`.
- Put business/capability behavior, ORM mappings, migrations, permissions, commands/events, tests, verifiers, and feature UI under `modules/<module_name>`.
- Put product-neutral shell orchestration, generated contracts/catalogs, design tokens, and reusable module-neutral UI primitives under `web/src`.
- Put module-specific DTOs, HTTP clients, state, preferences, commands, CSS, components, and tests under the owning module.
- Existing product-neutral helpers directly under `src/uok` are grandfathered. Do not create a new arbitrary root service; classify new shared code as Host, Kernel, or an owner module.

### 2. Public API change policy

- External Python callers may import only named supported symbols from the owner's `public_api.py`.
- External frontend callers may use only canonical `moduleSurface.tsx`, a documented owner client such as Reports' typed client, or neutral `web/src/contracts` / `web/src/shared` contracts.
- Add a public symbol only when a real external caller needs it. Record the caller, contract, authorization/tenant behavior, and compatibility impact.
- Boundary DTOs must be immutable or serialization-safe value data. Do not expose ORM instances, SQLAlchemy expressions, repositories, session factories, shell Workbench objects, or mutable owner entities.
- Breaking public contract changes require an ADR or explicit compatibility/migration record and updated contract tests.

### 3. No foreign ORM and no facade bypass

- A module must not import another module's models, schemas, repositories, services, `_internal`, migrations, or infrastructure.
- A module must not query, join, update, or foreign-key another feature's table through ORM, raw SQL, reflection, metadata lookup, or a compatibility registry.
- Shared Kernel tables may be used only through a manifest-declared scope and the established platform contract.
- Cross-module reads use the owner public API/read model. Cross-module commands use an owner command API/client or an explicitly governed event.
- Tenant, authorization, lifecycle, privacy, and audit enforcement stay inside the owner boundary.

### 4. Adding a new module

A new module must:

1. own one clear business or capability boundary;
2. use the canonical physical shape under `modules/<module_name>`;
3. declare a closed `uok.module.v1` manifest, unique API prefix, dependencies, permissions, commands/events, table ownership, retention, lifecycle, and extension points;
4. expose a narrow `public_api.py` when another module needs it;
5. keep ORM mappings and implementation private;
6. declare canonical module frontend metadata and `moduleSurface.tsx` only when it owns a workbench surface;
7. add module-owned migrations, tests, and a candidate verifier before claiming `runtime_proven`;
8. add or update generic architecture tests so private imports, foreign data access, cycles, and catalog drift fail CI.

A `planned` module remains inert and must not declare executable behavior.

### 5. When a split is allowed

Split an existing module only when all are true:

- a second stable business capability and language are evident;
- it can own an independent aggregate and table set;
- it has a distinct narrow public API;
- it has independent lifecycle, permission, retention, and verifier behavior;
- the current size/complexity causes measurable review, test, deployment, or ownership cost;
- the split does not require foreign ORM access, chatty calls, or a distributed transaction across the original aggregate.

Every split requires an ADR, data/migration ownership plan, compatibility plan, and extraction-style contract tests. LOC alone is not justification.

### 6. Dependency and cycle rule

- Feature dependencies point to Kernel contracts, exact documented Host adapter symbols, owner public APIs, or neutral frontend contracts only.
- Host composes features only through validated manifests and provider-origin checks.
- Shell imports feature code only from the generated module surface catalog.
- New cross-feature, feature/Host, Kernel/feature, or shell/feature SCCs are forbidden.
- Existing owner-internal SCCs and the product-neutral Host/platform validation SCC are grandfathered; they may not grow.

### 7. Required tests before merge

At minimum:

```powershell
python -m pytest -q -p no:cacheprovider tests/test_planning_data_boundary.py tests/test_module_public_api_boundaries.py tests/test_kernel_host_backend_boundaries.py tests/test_kernel_host_shell_boundaries.py tests/test_module_runtime_port.py
python scripts/quality_audit.py
python scripts/run_python_tests.py
npm --prefix web run check:contracts
npm --prefix web test
npm --prefix web run build:static
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify_uok_candidate.ps1
```

Also run the affected module tests, release-contract validation, container asset validation, dependency audits, and local runtime smoke when behavior or packaging changes.

Any new module, public symbol, Kernel contract, Host adapter path, shell port field, manifest extension, table claim, or cross-module integration must add or update an architecture test. GitHub CI must be green before merge.

## Accepted Residuals During The Freeze

- The 31 exact in-process Host request/command adapter imports, including the
  Product Master and Location Master HTTP adapters' `get_db` and `current_actor`
  seams.
- The six-file product-neutral Host/platform validation SCC, provided it does not grow.
- Contacts' three-file internal guided-import SCC.
- Planning's two-file backend SCC and two-file frontend type-level SCC.
- Shared SQLAlchemy `Session`, `Actor`, and metadata composition inside the monolith.
- Current static-analysis blind spots for computed imports, reflection, and raw SQL, provided reviews do not introduce those mechanisms.

Accepted does not mean permanent. These items are maintenance backlog, not authorization to add similar coupling.

## Unfreeze Policy

An intentional unfreeze requires:

1. a concrete product, scale, security, operations, or extraction need;
2. an ADR describing the proposed boundary change and alternatives;
3. before/after dependency and data-ownership evidence;
4. migration/compatibility/rollback plans;
5. updated architecture tests and freeze replacement;
6. successful local verification and hosted CI.

No unfreeze is permitted solely to improve folder aesthetics or chase a theoretical purity score.

## Validation

The freeze was established after:

- 151 / 151 expanded architecture tests passed;
- the module release contract passed for 7 modules, 80 commands, and 90 events;
- 117 unique Python test files were discovered and the current-head CI runner passed them;
- generated frontend contracts/catalog matched;
- both current-head GitHub candidate workflows passed;
- no P0 boundary regression was found.

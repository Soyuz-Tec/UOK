# UOK Architecture

**Current candidate:** `UOK-3.1.0-alpha.2`

**Current baseline tag:** `UOK-3.1.0-alpha.2-module-extension-baseline`

## Purpose

UOK is a small modular-monolith kernel for installable business and capability modules. The kernel must stay product-neutral while modules own business behavior, UI surfaces, permissions, data ownership, verification scenarios, and lifecycle evidence.

## System Context

```text
Operator browser
  -> FastAPI UOK runtime
     -> runtime kernel under src/uok
     -> module packages under modules/<module_name>
     -> PostgreSQL 18 local candidate database
     -> compiled React assets under src/uok/static/app
```

## Containers

| Container | Location | Responsibility |
|---|---|---|
| Backend kernel | `src/uok` | FastAPI composition, auth/session security, command bus, module registry, lifecycle APIs, static asset serving, baseline evidence, migration gates, compatibility facades. |
| Module packages | `modules/<module_name>` | Module manifest, backend package, UI ownership marker, migrations ownership marker, tests, candidate verifier scenarios, module-owned behavior. |
| Frontend shell | `web/src` | React + TypeScript + Vite workbench, navigation shell, shared controls, module surface registry, generated API contracts. |
| Database baseline | `migrations/001_initial_baseline.sql` | Initial shared candidate schema plus schema-version evidence. Future schema changes must be migration-gated and module-owned where applicable. |
| Candidate verification | `scripts/verify_uok_candidate.ps1`, `modules/*/tests/verify` | Release smoke and module-declared candidate scenarios. |

## Current Module Model

- `apps.manager` is the only required control module.
- `contacts.core` is the first optional capability module.
- Module metadata is read from `modules/<module_name>/manifest.yaml`.
- Backend runtime extension points are declared in manifests and resolved from module backend packages.
- Current declared backend extension surfaces include API routers, command handlers, command permissions, role grants, dashboard providers, evidence providers, model exports, and candidate verifier scripts.
- The frontend uses a compile-time module surface registry in `web/src/features/modules`; this is intentionally not runtime code loading from YAML yet.
- Contact business intelligence profiles are owned by `contacts.core`, declared in the module manifest, and documented in the Contacts module docs and architecture notes.

## Boundaries

- `src/uok` may provide shared services, shared database primitives, static serving, module composition, and compatibility facades.
- `modules/<module_name>` owns module behavior and must declare every extension point it uses.
- Product, cargo, CRM, accounting, inventory, document, and integration behavior must not be hardcoded into the kernel.
- Shared baseline SQLAlchemy models currently remain in `src/uok/models.py`; module packages import their owned domain models through module-local facades and declare owned tables for validation.
- Module-specific UI still lives in `web/src/features/<feature>` for this candidate, with ownership and composition expressed through the frontend module surface registry and module manifest `web_path`.
- Contacts pytest suites still live in top-level `tests/`; the Contacts candidate verifier scenario now lives under `modules/contacts.core/tests/verify`.
- Profile enrichment providers must be module adapters under `contacts.core` or future integration modules, not kernel services.

## Key Decisions

- ADR-0001: `docs/architecture/ADR-0001-module-extension-runtime-boundaries.md`
- Module extension contract: `docs/architecture/UOK_MODULE_EXTENSION_CONTRACT.md`
- Programming stack policy: `docs/architecture/UOK_PROGRAMMING_LANGUAGE_STACK_POLICY.md`
- UI policy: `docs/design/UOK_UI_DESIGN_POLICY.md`
- Module roadmap: `docs/architecture/UOK_MODULE_ROADMAP.md`
- Contact business intelligence profile architecture: `docs/architecture/UOK_CONTACT_BUSINESS_INTELLIGENCE_PROFILES.md`
- Contact BI developer handoff plan: `docs/modules/contacts.core/CONTACT_BI_PROFILES_PLAN.md`
- Contact BI audit checklist: `docs/modules/contacts.core/CONTACT_BI_PROFILES_AUDIT.md`

## Verification

Before publishing a candidate or moving the contact BI profile PR out of draft, run:

```powershell
python -m compileall -q src modules tests
python -m pytest -q
npm --prefix web test
npm --prefix web run build:static
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify_uok_candidate.ps1
```

Also review source size, module contract validation, source-boundary checks, naming checks, dependency audits, and the Podman compose local candidate smoke before promoting a baseline. For contact BI profiles, also complete `docs/modules/contacts.core/CONTACT_BI_PROFILES_AUDIT.md` with API smoke, browser QA, permission checks, and privacy/governance review evidence.

# UOK Programming Language Stack Policy

**Policy version:** `2026-07-05.v1`

**Status:** Mandatory for current and durable UOK development.

**Applies to:** UOK API code, module command handlers, product modules, persistence code, durable browser UI, build/runtime scripts that package production candidates, and future candidate verification gates.

This is a policy, not a recommendation. UOK must keep a narrow, explicit programming language stack so UOK can mature through repeated testing instead of accumulating competing frameworks, partially migrated surfaces, or product-specific shortcuts.

## Source Basis

This policy is based on the current UOK implementation and the following primary references:

- Python documentation: https://docs.python.org/3/
- Python typing documentation: https://docs.python.org/3/library/typing.html
- PEP 8 - Style Guide for Python Code: https://peps.python.org/pep-0008/
- FastAPI documentation: https://fastapi.tiangolo.com/
- FastAPI features and standards basis: https://fastapi.tiangolo.com/features/
- Pydantic documentation: https://docs.pydantic.dev/latest/
- SQLAlchemy 2.0 documentation: https://docs.sqlalchemy.org/en/20/
- PostgreSQL MVCC documentation: https://www.postgresql.org/docs/current/mvcc-intro.html
- PostgreSQL row security documentation: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- React TypeScript documentation: https://react.dev/learn/typescript
- TypeScript Handbook: https://www.typescriptlang.org/docs/handbook/intro.html
- Vite guide: https://vite.dev/guide/

The policy intentionally uses concepts from these sources, not copied vendor examples. UOK implementation decisions must be validated against the current local codebase, the executable `/api/architecture/language-stack` contract, and candidate verification scripts.

## Selected Stack

| Layer | Mandatory stack | Current UOK location | Role |
|---|---|---|---|
| UOK backend | Python `>=3.14`, current container runtime Python `3.14` | `src/uok/` | API, commands, module registry, workflow contracts, governance, reports, verification, local runtime |
| API framework | FastAPI `0.139.0` | `src/uok/main.py` | REST, WebSocket, OpenAPI surface, dependency boundaries |
| API/data validation | Pydantic `2.13.4` and Python type hints | request/response schemas, command payload validation | Typed API contracts, JSON-compatible payload discipline |
| Persistence access | SQLAlchemy `2.0.51` | `src/uok/models.py`, persistence modules | ORM mapping, transactional unit of work, SQL abstraction where appropriate |
| System of record | PostgreSQL `18` | Podman compose and production-shaped runtime | Transactions, tenant scoping, RLS verification, restore drills, event/outbox durability |
| Durable frontend | TypeScript `5.9.3` + React `19.2.7` | `web/src/` | Operator console, module testing, workflow UI, product-neutral shell |
| Frontend build | Vite `8.1.3` on Node `26` | `web/` | Local development build and compiled static assets |
| Styling | CSS with UOK design tokens | `web/src/design-tokens.css`, `web/src/styles.css` | Product-neutral, policy-driven UI styling |
| Local packaging | Podman-compatible OCI image | `Dockerfile`, `deploy/` | Repeatable local candidate deployment |

## Mandatory Principles

1. One production stack
   - New durable backend work belongs in Python under `src/uok/`.
   - New durable frontend work belongs in TypeScript under `web/src/`.
   - New frameworks or production languages require an architecture decision record, policy update, verifier update, and migration plan.

2. Typed boundaries
   - API, command, event, module, product, report, and registry boundaries must be typed or schema-backed.
   - Python type hints are required for new exported backend functions and data structures.
   - TypeScript `strict` mode remains mandatory for durable frontend code.
   - JSX-bearing React files must use `.tsx`.

3. FastAPI owns the API boundary
   - UOK REST and WebSocket endpoints stay in FastAPI unless an ADR replaces the backend boundary.
   - Public APIs should remain OpenAPI-compatible.
   - Backend validation should use Pydantic or explicit command validation rather than ad hoc request parsing.

4. PostgreSQL owns durable state
   - PostgreSQL 18 is the system of record for candidate-grade local testing and production-shaped runtime behavior.
   - SQLite or file-backed shortcuts may exist only as explicitly documented local fallback or migration scaffolding.
   - Tenant scoping, row-level security declarations, restore drills, migrations, and transaction evidence are release gates where applicable.

5. SQLAlchemy owns application persistence mapping
   - Use SQLAlchemy for ORM-backed persistence and transaction management.
   - Raw SQL is allowed for migrations, projections, RLS policy work, and database-specific verification when it is clearer than ORM abstraction.
   - Product modules must not bypass declared persistence boundaries to write UOK-owned internal tables directly.

6. React + TypeScript owns durable UI
   - Durable UI features must be React components written in TypeScript.
   - Plain JavaScript screens are not allowed for executable durable UI.
   - Module/product UI must be driven by backend manifests, registries, workflow contracts, permissions, and product metadata.
   - The core UI shell must not hardcode product-specific names; selected product labels come from product manifests.

7. Vite owns frontend builds
   - Vite remains the frontend build tool for local and container builds.
   - The compiled frontend must be present under `src/uok/static/app` for local candidate packaging.
   - The frontend API boundary must use generated TypeScript contracts from the FastAPI OpenAPI schema.
   - Node.js used for Vite builds must satisfy the Vite compatibility requirement. The current container uses Node `26`.

8. CSS token discipline
   - CSS is allowed and required for design-token implementation.
   - Avoid adding heavy UI frameworks until repeated component complexity proves the need and an ADR updates this policy.
   - Styling must remain aligned with `docs/design/UOK_UI_DESIGN_POLICY.md` and `docs/design/UOK_APPLE_HIG_TECHNICAL_REFERENCE.md`.

9. Dependency discipline
   - Python dependencies must be declared and pinned in `pyproject.toml` and `requirements.txt`.
   - Frontend dependencies must be declared in `web/package.json` and locked in `web/package-lock.json`.
   - Do not add `latest` dependency ranges to release-candidate code.
   - Do not add duplicate libraries for the same job without an ADR.

10. Verification before expansion
    - New language, framework, runtime, package manager, ORM, UI framework, or build tool adoption is blocked until the current candidate passes compile, tests, frontend build, language-stack verification, and architecture alignment verification.

11. Maintainable source limits
    - UOK source must stay within reviewable size and responsibility limits from the beginning of development.
    - Large files must be split by architectural responsibility before new module expansion continues.
    - Route files should remain thin and should delegate behavior to services, command handlers, policy modules, or verification modules.
    - Frontend hooks should not combine unrelated concerns such as session management, data fetching, module actions, and business workflows when those concerns can be extracted into focused hooks or services.
    - CSS must be organized by design-system layer, shell, shared controls, and feature surface instead of accumulating unrelated rules in one global file.
    - Tests must be split by behavior area when one test file begins mixing auth, module lifecycle, Contacts, candidate evidence, and security regressions.
    - Generated files and lockfiles are exempt from manual size splitting, but they must not be edited by hand.
    - The purpose of these limits is to eliminate avoidable rewrites, reduce review time, and keep UOK development speed high as modules are added.

12. Architecture-guided development speed
    - UOK architectural guidance is a development control, not an after-the-fact review note.
    - From this point forward, new code must be placed in the correct language, layer, module, and responsibility boundary before it is expanded.
    - Source-size targets, module boundaries, naming policy, UI policy, generated API contracts, and verification gates must be used together to keep code inside the desired maintainability limits.
    - Developers must split or redirect code as soon as a file or component starts carrying unrelated responsibilities, so future work does not require a rewrite only to reach the correct architecture.
    - The expected result is faster development over time: smaller review units, fewer blocked refactors, less duplicate implementation, and no slowdown caused by avoidable architectural cleanup.

13. Agent Markdown and guardrail verification
    - Before future development expands implementation, recently created or modified agent-authored Markdown artifacts must be reviewed for active requirements, guardrails, targets, and unresolved constraints.
    - This includes architecture reports, design policies, language-stack policies, module plans, rating charts, roadmap notes, and candidate target documents under `docs/`.
    - New code must be checked against those Markdown guardrails before it is treated as aligned with UOK architecture.
    - If a recently created Markdown artifact introduces a policy, target, naming rule, module boundary, UI rule, or verification gate, the implementation must either comply with it or update the artifact through the normal policy-change process.
    - This prevents agent-created guidance from becoming stale notes and keeps future development synchronized with the latest accepted UOK decisions.

## Closed Exception

The legacy static fallback used HTML, CSS, and JavaScript in `src/uok/static/index.html`.

That exception is closed in `UOK-3.0.0-rc8`. The executable fallback business logic has been removed; the root route must serve only the compiled React app or return an explicit missing-build error. New durable UI work belongs under `web/src` and must pass TypeScript, frontend tests, OpenAPI generation, and the candidate verification gates.

## Prohibited Without ADR

Do not introduce these into durable UOK production code without an ADR, policy update, verifier update, and migration plan:

- A second frontend framework such as Angular, Vue, Svelte, Next.js, Remix, or server-rendered React routing.
- A second backend web framework such as Django, Flask, Litestar, Fastify, NestJS, Spring, ASP.NET, Phoenix, or Rails.
- A second production backend language such as Java, C#, Go, Rust, Elixir, Ruby, PHP, or Node.js.
- A second ORM or query framework for the same persistence boundary.
- A second package manager for the same frontend workspace.
- Durable product-specific UI hardcoding in the core shell.

This restriction applies to UOK production code. It does not prohibit one-off local scripts, generated reports, test helpers, or future external adapters when they are documented as adapters and kept outside the UOK core.

## Allowed Supporting Code

| Supporting code | Allowed use | Boundary |
|---|---|---|
| PowerShell | Windows local verification, packaging, Podman commands | Not application runtime logic |
| POSIX shell | Container smoke tests and cross-platform helper scripts | Not UOK business logic |
| SQL | Migrations, RLS, restore verification, projections | Must be versioned or verifier-owned |
| YAML/JSON | Module manifests, metadata, configuration | Must remain schema-compatible and validated |
| Generated JS/CSS | Vite build output under `src/uok/static/app` | Do not edit generated assets manually |

## Implementation Rules

### Python Backend

- Use Python modules under `src/uok/` for UOK capabilities.
- Keep command handlers explicit and testable.
- Use type hints for public functions, command payload structures, registry records, verification outputs, and module contracts.
- Use Pydantic for API models where request/response schema clarity matters.
- Keep module boundaries explicit: core modules expose public APIs; product modules extend through manifests, commands, events, registry metadata, and declared extension surfaces.
- Do not move product-specific behavior into the UOK core.
- Do not use dynamic monkey patching, runtime import hacks, or hidden global state for product behavior.

### FastAPI Boundary

- Routes must be thin: authentication, request validation, command dispatch, and response shaping only.
- Business behavior belongs in commands, services, modules, or verification functions.
- Public routes should remain documented through OpenAPI-compatible request/response shapes.
- Authentication and authorization dependencies must remain centralized.
- When route files grow beyond one API concern, split them into `api/` routers by domain. The root app module should compose routers, static assets, lifespan, and exception handlers only.

### SQLAlchemy and PostgreSQL

- Use SQLAlchemy sessions consistently for request/command units of work.
- Keep transaction boundaries explicit around command handling, event writes, outbox writes, and lifecycle transitions.
- Use PostgreSQL-specific SQL deliberately for RLS, migrations, restore drills, and projections.
- RLS and tenant filters must be tested, not merely declared.
- Database schema changes must be verifiable through migration or candidate verification scripts.

### TypeScript Frontend

- Use `.tsx` for React components and `.ts` for non-JSX TypeScript modules.
- Keep `allowJs: false` and `strict: true` in the durable frontend.
- Represent API responses with interfaces or types at the use boundary.
- UI state should be explicit, not inferred from untyped `any` except for temporary compatibility surfaces that must be narrowed later.
- Product/workflow labels must come from backend module/product metadata.
- Use reusable components for shell, toolbar, navigation, command buttons, status pills, panels, tables/lists, forms, and workflow steppers.
- Split hooks and components before they become mixed-responsibility files. API/client orchestration, stored session state, module actions, Contacts workflows, and form drafting should remain independently reviewable.

### Maintainability Scan

Before each candidate package, run a source-size scan and split any non-generated file that is too large or mixed-responsibility for efficient human review. As a working target:

- Backend route composition files should generally stay under `200` lines.
- Backend command bus files should generally stay under `200` lines.
- Backend business service files should generally stay under `300` lines unless the file is a cohesive policy module.
- React component and hook files should generally stay under `300` lines.
- CSS files should be split when they cross feature or layer boundaries, even if they still build correctly.
- Test files should be split when they cover more than one major behavior area.

These limits are architectural guardrails, not arbitrary formatting rules. A larger file is acceptable only when it is cohesive, generated, or explicitly justified in the architecture notes and still passes the same verification gates.

### Vite Build

- `npm run build:static` is the required local static build path for packaging FastAPI-served assets.
- Container builds must compile the frontend and copy the output into `src/uok/static/app`.
- Generated assets are build artifacts. Edit source in `web/src/`, not generated files.

## Candidate Acceptance Gates

A candidate is not acceptable if it:

- Adds durable frontend behavior outside `web/src`.
- Adds plain JavaScript source for new durable UI.
- Removes TypeScript strict mode.
- Adds a second frontend or backend framework without ADR approval.
- Adds a second production language inside UOK.
- Bypasses FastAPI for public API behavior.
- Bypasses SQLAlchemy/PostgreSQL boundaries for durable state.
- Stores product-specific labels or workflow behavior in the core shell instead of product manifests/contracts.
- Changes dependency tools without updating this policy and verification.
- Ships without a compiled React frontend in `src/uok/static/app`.

Before packaging a candidate, developers must run or preserve equivalent evidence for:

```powershell
python -m compileall -q src
cd .\web; npm ci; npm run build:static; cd ..
$env:PYTHONPATH='src'; python -m pytest -q
powershell -ExecutionPolicy Bypass -File .\scripts\verify_uok_candidate.ps1
```

## Policy Change Process

Changing this stack requires:

1. An architecture decision record that explains the problem, alternatives, migration cost, operational impact, and rollback path.
2. Updates to this policy.
3. Updates to `src/uok/language_stack.py`.
4. Updates to architecture alignment evidence.
5. Tests or scripts that fail when the old and new rules are violated.
6. A successful local candidate rebuild and verification run.

## Current Decision

For UOK V3.0.0-rc9 and the next local production-candidate iterations, the approved stack is:

```text
Backend:  Python + FastAPI + Pydantic + SQLAlchemy + PostgreSQL
Frontend: TypeScript + React + Vite + CSS design tokens
Runtime:  Python 3.14 container, Node 26 frontend build container, PostgreSQL 18, Podman-compatible OCI image, FastAPI serving compiled React assets
Contract: Generated TypeScript API types from the FastAPI OpenAPI schema
Fallback: no executable static fallback business logic
```

# UOK Code Quality And Technology Audit Standard

**Status:** Mandatory active standard.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Applies to:** source organization, line-of-code integrity, dependency discipline, runtime stack alignment, technology choices, reviewability, tests, GitHub readiness, and local candidate verification.

## Purpose

UOK development must stay easy to review, test, extend, and operate as modules grow. This standard turns quality lessons into enforceable rules so future work does not create avoidable rewrites, hidden technical debt, or slow expansion.

This standard implements the quality and technology-audit layer of the broader `docs/architecture/UOK_INTERNAL_ENGINEERING_SYSTEM.md`, which maps UOK practice to Microsoft SDL, Google Engineering Practices, SLSA, OpenSSF Scorecard, ISO/IEC/IEEE 12207, ISO/IEC/IEEE 15288, ISO/IEC/IEEE 42010, ISO/IEC 25010, ISO/IEC 5055, ISO/IEC/IEEE 29119, NIST SP 800-218 SSDF, OWASP ASVS, and OWASP SAMM.

The executable audit entry point is:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
```

## Quality Principles

1. Keep one clear owner for every change.
   - Runtime composition and shared infrastructure belong in `src/uok`.
   - Business or capability behavior belongs in `modules/<module_name>`.
   - Product-neutral shell, composition, generated contracts, and shared UI primitives belong in `web/src`.
   - Module-specific production UI and CSS belong in `modules/<module_name>/web/src`; module frontend tests belong in `modules/<module_name>/tests/web`.

2. Keep files reviewable.
   - Split before a file carries unrelated responsibilities.
   - Prefer focused components, hooks, command handlers, read models, policy modules, and tests.
   - Generated files and lockfiles are exempt from manual splitting, but must not be edited by hand.

3. Keep the stack narrow.
   - Backend work uses Python, FastAPI, Pydantic, SQLAlchemy, and PostgreSQL.
   - Frontend work uses TypeScript, React, Vite, generated API types, and CSS design tokens.
   - Podman-compatible local packaging uses Python 3.14, Node 26, and PostgreSQL 18.
   - New durable languages, frameworks, ORMs, package managers, or UI systems require an ADR and policy update before implementation.

4. Keep quality executable.
   - A rule that can be checked should become a script, test, CI step, or candidate verifier.
   - A repeated manual review comment should become a shared component, reusable service, policy, or verifier.

5. Keep evidence current.
   - Documentation must reflect current behavior.
   - Current tests, CI, manifests, and live runtime checks are stronger than older notes.
   - Local evidence under `var/` stays out of Git unless sanitized and explicitly promoted.

## Line-Of-Code Integrity

Line count is a reviewability signal, not the only quality signal. UOK uses a tiered model:

- `300` lines is the hard local audit threshold for scanned non-generated source files.
- `200` lines is the soft review threshold for route composition, command-family files, React components, hooks, and tests.
- Files above the soft threshold are acceptable only when they remain cohesive and have a clear owner.
- Files above the hard threshold must be split or explicitly justified in the owning architecture or module document.

The working source-size target is:

| File class | Target |
|---|---|
| Backend route composition | soft warning above `200` lines; hard gate above `300` lines |
| Backend command bus or command-family files | soft warning above `200` lines; hard gate above `300` lines |
| Backend business services, read models, and policy modules | soft warning above `250` lines; hard gate above `300` lines unless cohesive and documented |
| React components and hooks | soft warning above `200` lines; hard gate above `300` lines |
| CSS | split by design-system layer, shell, shared primitive, or feature surface |
| Tests | split by behavior area when scenarios become unrelated |

Function and component guidance:

- Prefer functions under `60` lines unless the logic is a cohesive parser, mapper, or validation table.
- Prefer React render components that mainly render one surface, with data loading and mutation orchestration in hooks.
- Prefer backend API routes that delegate validation, command handling, and read-model shaping to focused helpers.
- Prefer test files grouped by behavior area; a test file above `200` lines should still describe one scenario family.
- Cohesive pytest `test_*` scenario bodies may exceed the normal `60` line function preference when splitting the body would make the behavior harder to audit; the executable audit still applies the `200` line soft threshold to the owning test file.

Soft warnings do not fail the build by themselves. They must appear in repeatable audit evidence, including the full `source_size_policy` section of `EngineeringEvidence`, and reduce the relevant quality scorecard category so they can be reviewed before expansion. Hard violations fail `TechnologyAudit`, `Audit`, and `Verify`.

The audit gate checks non-generated source files in:

- `src`
- `modules`
- `web/src` and module frontend roots under `modules`
- `tests`
- `scripts`
- `migrations`

The hard local audit threshold is `300` lines for scanned non-generated source files. A larger file is allowed only when it is generated, a lockfile, a compiled asset, or explicitly justified in the relevant architecture or module document.

## Technology Audit Rules

The technology audit must confirm:

- required architecture, policy, operations, and GitHub artifacts exist;
- the UOK Internal Engineering System is documented, linked, and populated with the well-known standard names it adopts;
- Python version policy remains `>=3.14`;
- runtime and development Python dependencies are pinned, separated, and exactly aligned with the corresponding `pyproject.toml` dependency groups;
- TypeScript `strict` remains enabled and `allowJs` remains disabled;
- durable frontend JavaScript is not added under `web/src` or `modules/*/web/src`;
- `web/package-lock.json` is present;
- direct frontend runtime dependencies and the governed lint toolchain use approved exact versions, the lockfile root matches the manifest, and critical runtime packages resolve once;
- ESLint covers shell, shared, module production, tests, end-to-end tests, configs, and frontend scripts with React Hooks correctness enforced;
- Stylelint covers shell and module CSS, rejects hexadecimal colors outside `web/src/design-tokens.css`, the configured physical left/right property list, `text-align: left|right`, unjustified `!important`, and ID selectors;
- the built frontend stays within reviewed raw and gzip JavaScript/CSS budgets, and CI runs the budget check only after the production build;
- Dockerfile, local compose, and CI stay aligned with Python 3.14, Node 26, and PostgreSQL 18;
- container stages install runtime Python requirements only;
- the repository wires a non-mutating OpenAPI JSON and generated TypeScript declaration drift check; the broader `Audit` gate executes it and requires exact runtime-schema parity;
- every module manifest has `backend`, `web`, `migrations`, and `tests` folders;
- local evidence under `var/` remains ignored;
- this standard is linked from the documentation index and operations runbook.
- active documentation repository references, internal links, and index coverage resolve with exact path casing and contain no retired frontend locations.
- engineering evidence includes a repeatable quality scorecard.

## Frontend Quality Gates

Frontend changes must run the platform gates in dependency order:

```powershell
npm --prefix web ci
npm --prefix web run check:contracts
npm --prefix web audit --audit-level=low
npm --prefix web run check:dependencies
npm --prefix web run lint
npm --prefix web run lint:styles
npm --prefix web test
npm --prefix web run test:accessibility
npm --prefix web run build:static
npm --prefix web run check:bundle-budget
```

`check:dependencies` is the direct-manifest and lockfile authority. `lint` and
`lint:styles` are correctness gates rather than formatting suggestions.
`check:bundle-budget` measures every emitted JavaScript and CSS asset in raw and
gzip form and fails closed when assets are missing or exceed the reviewed
ceiling. Current ceilings are owned by
`docs/design/UOK_WORKSPACE_UI_IMPLEMENTATION_STANDARD.md`.

The canonical maturity assessment, reuse inventory, and sequenced remediation
work are owned by
`docs/architecture/UOK_FRONTEND_PLATFORM_AUDIT_AND_MODERNIZATION_PLAN.md`.

## Quality Scorecard

`EngineeringEvidence` must generate a structured scorecard after each meaningful build or feature. The scorecard converts the executable audit results into comparable categories:

- correctness;
- test coverage;
- split quality;
- reuse and boundaries;
- module discipline;
- UI consistency;
- runtime efficiency;
- security and supply chain;
- documentation;
- CI and release readiness.

The scorecard is not a replacement for `Verify`. It is a repeatable review aid that shows whether the current work still follows the desired engineering system and where the next improvement should go.

## Efficiency Rules

- Prefer typed contracts and generated API types over hand-maintained duplicated shapes.
- Prefer shared module-neutral UI primitives over copied controls.
- Prefer database-backed filtering, grouping, and search for scalable workflows, with Python orchestration where workflow logic requires it.
- Keep expensive operations behind explicit user actions, paginated APIs, or indexed database queries.
- Avoid loading full datasets into UI state when a paginated or filtered read model can satisfy the workflow.
- Keep command writes transactional and auditable.

## Redundancy Rules

Treat these as code smells:

- duplicate search/filter/sort state models in one feature;
- repeated modal, popover, inline-edit, or table behavior outside shared components;
- duplicated API response typing instead of generated or shared types;
- copied business rules across routes, facades, and UI;
- module behavior in both `src/uok` and `modules/<module_name>`;
- docs that repeat policy without linking to the owning artifact.

When a reusable behavior appears in a second place, move it to the smallest shared owner before a third copy is created.

## Audit Commands

Technology audit:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
```

Standard audit:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Audit
```

Candidate verification:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```

Engineering scorecard and evidence:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action EngineeringEvidence
```

GitHub preparation:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action GithubPreflight
```

## Completion Definition

A code-quality or technology-standardization task is complete only when:

- the owning Markdown artifact is updated;
- the executable technology audit passes;
- affected tests or audits pass;
- the change does not introduce source-size, naming, module-boundary, or dependency drift;
- any remaining risk is stated clearly before handoff.

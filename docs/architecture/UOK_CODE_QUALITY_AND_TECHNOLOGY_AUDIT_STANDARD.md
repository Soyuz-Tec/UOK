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
   - Shared UI primitives belong in `web/src/shared`.
   - Feature UI belongs in `web/src/features/<feature>`.

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

The working source-size target is:

| File class | Target |
|---|---|
| Backend route composition | generally under `200` lines |
| Backend command bus or command-family files | generally under `200` lines |
| Backend business services, read models, and policy modules | generally under `300` lines unless cohesive |
| React components and hooks | generally under `300` lines |
| CSS | split by design-system layer, shell, shared primitive, or feature surface |
| Tests | split by behavior area when scenarios become unrelated |

The audit gate checks non-generated source files in:

- `src`
- `modules`
- `web/src`
- `tests`
- `scripts`
- `migrations`

The hard local audit threshold is `300` lines for scanned non-generated source files. A larger file is allowed only when it is generated, a lockfile, a compiled asset, or explicitly justified in the relevant architecture or module document.

## Technology Audit Rules

The technology audit must confirm:

- required architecture, policy, operations, and GitHub artifacts exist;
- the UOK Internal Engineering System is documented, linked, and populated with the well-known standard names it adopts;
- Python version policy remains `>=3.14`;
- Python dependencies are pinned;
- TypeScript `strict` remains enabled and `allowJs` remains disabled;
- durable frontend JavaScript is not added under `web/src`;
- `web/package-lock.json` is present;
- Dockerfile, local compose, and CI stay aligned with Python 3.14, Node 26, and PostgreSQL 18;
- every module manifest has `backend`, `web`, `migrations`, and `tests` folders;
- local evidence under `var/` remains ignored;
- this standard is linked from the documentation index and operations runbook.

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

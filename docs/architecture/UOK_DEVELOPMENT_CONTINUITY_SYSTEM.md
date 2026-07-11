# UOK Development Continuity System

**Status:** Mandatory development operating guide.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Applies to:** UOK code changes, module work, UI work, architecture updates, verification improvements, and future candidate preparation.

## Purpose

UOK development must preserve accepted lessons as durable artifacts. The goal is simple: each future change should start from the current verified architecture, policies, tests, and live runtime behavior instead of depending on memory or one-off chat summaries.

This document defines the continuity loop for systematic development and improvement.

## Source Of Truth Order

Use this order when facts conflict:

1. GitHub target branch plus current local repository files and Git state
2. Tests, module manifests, migrations, and generated contracts
3. Live local runtime evidence from the active candidate stack
4. `docs/ARCHITECTURE.md` and active policy documents
5. ADRs and module plans
6. Prior research records and historical target notes
7. Chat history or external memory

External memory can speed orientation, but it is advisory. Repo-local Markdown and executable verification are the durable continuity system.

## GitHub Synchronization Policy

GitHub is the shared UOK source of truth for code, documentation, tests, workflows, deployment definitions, and team synchronization.

For normal UOK development:

1. Start non-trivial work by checking the current branch and upstream state.
2. Treat a local working tree as temporary working state until it is committed and pushed.
3. Commit and push completed verified work when publication is safe, instead of waiting for a repeated reminder.
4. Do not publish local-only evidence under `var/`, secrets, personal data, incomplete work, failing verification, or changes that need upstream reconciliation.
5. If the GitHub branch moved, reconcile by pull, rebase, or a reviewable branch before publishing.
6. Use `GithubReadiness`, `GithubSecuritySetup`, and `GithubPrChecks` for repeatable GitHub verification instead of manually retyping `gh` commands.

## Development Loop

Every non-trivial UOK task follows this loop:

1. Establish authority
   - Confirm repo root, branch, active runtime target, Git state, and relevant docs.
   - Read `docs/ARCHITECTURE.md`, this document, and affected policy or module docs.

2. Locate ownership
   - Decide whether the change belongs in `src/uok`, `modules/<module-name>`, the product-neutral `web/src` shell/shared layer, module production UI under `modules/<module-name>/web/src`, module frontend tests under `modules/<module-name>/tests/web`, migrations, verification, or docs.
   - Product-specific or business-specific behavior must stay in installable modules.

3. Implement within current stack
   - Backend: Python, FastAPI, Pydantic, SQLAlchemy, PostgreSQL.
   - Frontend: TypeScript, React, Vite, CSS design tokens.
   - Module frontend composition: closed-manifest `web_surface`, `web_entry`, and `web_section` metadata generate literal compile-time imports; the browser never loads YAML or dynamic manifest paths.
   - Do not add a new durable language, framework, ORM, build tool, or UI system without an ADR and policy update.

4. Keep the source reviewable
   - Split files before they become mixed-responsibility.
   - Keep route files thin, command handlers focused, UI components scoped, and CSS feature/layer based.
   - Move global reusable UI and logic into shared module-neutral homes instead of copying it into feature code.

5. Update Markdown artifacts
   - Update the active policy, module plan, architecture record, or ADR that owns the decision.
   - Add links in `docs/DOCUMENTATION_INDEX.md` when a durable artifact is added.
   - Keep current facts separate from future targets.

6. Verify
   - Run the relevant compile, test, build, audit, naming, boundary, module contract, and candidate checks.
   - Generate `EngineeringEvidence` when the task changes code quality, release readiness, or durable workflow rules.
   - For UI work, verify the local runtime and light/dark/system behavior when possible.

7. Record outcome
   - Report what changed, what passed, what was not verified, and what remains.
   - Prepare completed verified work for commit and push under the GitHub synchronization policy.

## Active Lessons Preserved

These accepted lessons must guide future implementation:

| Lesson | Practical rule | Primary artifact |
|---|---|---|
| UOK is product-neutral | Keep product, cargo, CRM, accounting, inventory, document, and integration behavior out of `src/uok` unless it is shared runtime infrastructure | `docs/ARCHITECTURE.md` |
| UOK is a modular monolith | Modules are independently developable, installable, upgradable, disableable, and maintainable through manifests and declared extension points | `docs/architecture/UOK_MODULE_EXTENSION_CONTRACT.md` |
| Apps Manager is the starter control module | Keep the baseline minimal and let users install needed modules | `docs/architecture/UOK_MODULE_ROADMAP.md` |
| Agents Core is the AI governance boundary | Agent runbooks, Codex tool binding, human approval gates, and compliance evidence belong in `agents.core`, not in the kernel | `docs/architecture/UOK_AI_OPERATIONS_KERNEL_ARCHITECTURE.md` |
| Contacts is the first optional capability module | Contacts behavior belongs in `contacts.core` and its module docs/tests | `docs/modules/contacts.core/CONTACTS_APP_PLAN.md` |
| Stack discipline prevents rewrites | Write durable backend in Python and durable frontend in React + TypeScript + Vite | `docs/architecture/UOK_PROGRAMMING_LANGUAGE_STACK_POLICY.md` |
| Engineering system is internalized | Convert Microsoft SDL, Google Engineering Practices, SLSA, OpenSSF Scorecard, ISO, NIST, and OWASP guidance into UOK policies, gates, reviews, release evidence, and dashboards | `docs/architecture/UOK_INTERNAL_ENGINEERING_SYSTEM.md` |
| Quality standards are executable | Keep source reviewable, dependencies pinned, stack choices audited, and line-of-code integrity enforced | `docs/architecture/UOK_CODE_QUALITY_AND_TECHNOLOGY_AUDIT_STANDARD.md` |
| Quality scorecards are repeatable | Generate engineering evidence with a comparable scorecard after meaningful feature work | `scripts/engineering_evidence.py` |
| UI policy is mandatory now | Apply the Apple-informed UOK UI policy to current work, not only future redesigns | `docs/design/UOK_UI_DESIGN_POLICY.md` |
| Workspace UI implementation is standardized | Use the UOK workspace UI implementation standard for specialist review roles, workspace anatomy, shared primitive promotion, and UI verification gates | `docs/design/UOK_WORKSPACE_UI_IMPLEMENTATION_STANDARD.md` |
| Global reusable UI belongs in shared areas | Reusable pop-ups, inline editing, searchable filters, tables, and column resizing belong in module-neutral shared components | `web/src/shared` and `docs/design/UOK_UI_DESIGN_POLICY.md` |
| Module frontend ownership is physical | Keep module production React source and local CSS under `modules/<module>/web/src`, module frontend tests under `modules/<module>/tests/web`, and compose declared surfaces through the checked-in generated catalog | `docs/architecture/ADR-0023-module-local-frontend-composition.md` |
| Frontend manifests are compile-time truth | Generate literal imports from closed `web_surface`, `web_entry`, and `web_section` metadata; never load manifest YAML or dynamic module paths in the browser | `docs/architecture/UOK_MODULE_EXTENSION_CONTRACT.md` |
| Shell state compatibility is transitional | The broad Workbench surface host may preserve current orchestration during relocation, but new module behavior must not expand module-specific shell coupling | `docs/architecture/ADR-0023-module-local-frontend-composition.md` |
| Reports owns report transport | Keep the typed report client in `modules/reports.core/web/src`; module consumers may use that client without relocating it into shared shell utilities | `modules/reports.core/web/README.md` |
| Planned Agents remains inert | Do not add an executable Agents surface, permission, or active extension until its manifest maturity and evidence change | `modules/agents.core/web/README.md` |
| Planning authority remains server-side | Python module service first, with React UI receiving validated schedule read models. | `docs/architecture/ADR-0023-module-local-frontend-composition.md` |
| Contacts BI is derived | Business intelligence profiles summarize existing contact signals and must not become a hidden source of truth | `docs/architecture/UOK_CONTACT_BUSINESS_INTELLIGENCE_PROFILES.md` |
| Naming is a boundary | Use only `UOK` and `Unified Operating Kernel`, with lowercase `uok` only where technical surfaces require it | `docs/architecture/UOK_NAMING_CONVENTIONS.md` |
| Local runtime evidence matters | HTTP checks and candidate verifier output are stronger than visual assumptions | `scripts/verify_uok_candidate.ps1` |
| Repeatable operations matter | Verification, audit, backup, restore, rebuild, GitHub preflight, and ASUH drills use standardized commands | `docs/operations/UOK_STANDARD_OPERATIONS.md` |
| GitHub is the shared source of truth | Completed verified work is synchronized through GitHub unless explicitly local-only or blocked by verification, upstream divergence, or unsafe artifacts | `docs/operations/UOK_GITHUB_ENGINEERING_GUARDRAILS.md` |
| GitHub checks are automated | Readiness, security setup, and PR check watching use wrapper actions instead of ad hoc `gh` command sequences | `scripts/uok_github_ops.ps1` |
| Markdown guardrails are active | Recently created policy, architecture, design, roadmap, target, and module-plan docs must be checked before implementation expands | This document |

## Markdown Ownership Matrix

| Change type | Required Markdown action |
|---|---|
| New module | Update `docs/architecture/UOK_MODULE_ROADMAP.md`, add `docs/modules/<module-name>/`, and ensure module-local `README.md` files exist |
| Agent runbook, governed tool binding, AI approval gate, or agent evidence change | Update `docs/architecture/UOK_AI_OPERATIONS_KERNEL_ARCHITECTURE.md` and `docs/modules/agents.core/AGENTS_CORE_MODULE_PLAN.md` |
| New module extension surface | Update `docs/architecture/UOK_MODULE_EXTENSION_CONTRACT.md`, `docs/architecture/UOK_MODULE_MANIFESTS_AND_BOUNDARIES.md`, tests, and an ADR if material |
| New or changed module frontend surface | Update the owning manifest `web_surface`/`web_entry`/`web_section`, module-local `web/README.md`, generated frontend catalog, module frontend tests, and ADR/policy docs when the boundary changes |
| New command, event, permission, API, migration, or owned table | Update module manifest, tests, module plan, and verification evidence |
| New global UI primitive | Update or confirm `docs/design/UOK_UI_DESIGN_POLICY.md` and use `web/src/shared` |
| Workspace UI implementation method, specialist role, or shared primitive promotion rule | Update `docs/design/UOK_WORKSPACE_UI_IMPLEMENTATION_STANDARD.md`; update `docs/design/UOK_UI_DESIGN_POLICY.md` only when the design policy itself changes |
| Contacts workflow change | Update `docs/modules/contacts.core/CONTACTS_APP_PLAN.md` and related design plan when UI behavior changes |
| Contact BI profile change | Update `docs/architecture/UOK_CONTACT_BUSINESS_INTELLIGENCE_PROFILES.md` |
| Language, framework, dependency, or build change | Add an ADR and update `docs/architecture/UOK_PROGRAMMING_LANGUAGE_STACK_POLICY.md` |
| Engineering system, checklist, review, release gate, dashboard, or audit-evidence change | Update `docs/architecture/UOK_INTERNAL_ENGINEERING_SYSTEM.md`, operations docs, CI, and PR template as applicable |
| Code quality, line-of-code, efficiency, or technology audit change | Update `docs/architecture/UOK_CODE_QUALITY_AND_TECHNOLOGY_AUDIT_STANDARD.md`, `scripts/quality_audit.py`, and operations docs |
| Quality scorecard, evidence schema, or dashboard metric change | Update `scripts/engineering_evidence.py`, `scripts/quality_scorecard.py`, quality docs, operations docs, and tests |
| Naming, product, or cargo modeling change | Update naming and separation policy docs before implementation is accepted |
| Candidate verification gate change | Update `docs/ARCHITECTURE.md`, this guide, verifier scripts, and tests |
| Local operation, backup, restore, rebuild, GitHub, or ASUH procedure change | Update `docs/operations/UOK_STANDARD_OPERATIONS.md`, `docs/operations/UOK_ASUH_TEST_EVENTS.md`, and related scripts |
| New durable Markdown artifact | Link it from `docs/DOCUMENTATION_INDEX.md`; link it from `docs/ARCHITECTURE.md` if it affects architecture or mandatory workflow |

## Maintainability Controls

Use these controls continuously, not only before release:

- Prefer focused files over large mixed files.
- Keep backend routes under API composition responsibility.
- Keep command handlers grouped by command family.
- Keep read models separate from write commands.
- Keep derived profile logic separate from editable source-of-truth records.
- Keep UI components, hooks, shared controls, and CSS split by responsibility.
- Keep module-specific UI and CSS in the owning module; keep only product-neutral shell, global tokens, generated contracts, and reusable controls under `web/src`.
- Keep tests grouped by behavior area.
- Keep module frontend tests under the canonical `modules/<module>/tests/web` path so Vitest can discover them and container validation can exclude them from production.
- Keep generated files out of manual edits.

The working target remains:

- backend route composition files: generally under `200` lines
- backend command bus files: generally under `200` lines
- backend business service files: generally under `300` lines unless cohesive
- React component and hook files: generally under `300` lines
- CSS files: split by feature or design-system layer
- test files: split when they mix major behavior areas

## Verification Pack

Run the full pack before candidate promotion:

```powershell
python -m compileall -q src modules tests conftest.py
python scripts/run_python_tests.py
npm --prefix web run check:contracts
npm --prefix web test
npm --prefix web run build:static
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify_uok_candidate.ps1
```

Run the focused quality and technology audit before expanding a feature area:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
```

Generate comparable engineering evidence and quality scorecard after meaningful feature work:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action EngineeringEvidence
```

The standardized wrapper is:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```

Run these supporting checks when relevant:

```powershell
python -m pip_audit -r requirements-dev.txt
npm --prefix web run check:contracts
npm --prefix web audit
```

Run these architecture checks when boundaries, modules, docs, or naming are touched:

```powershell
$env:PYTHONPATH='src'; python -c "from uok.module_release_contract import validate_module_release_contracts; import json; r=validate_module_release_contracts(); assert r['ok'], r; print(json.dumps(r, indent=2))"
python -m pytest tests/test_naming_policy.py -q
```

Use the local candidate stack for runtime evidence:

```powershell
podman compose -p uok -f deploy\compose-local-18088.yaml up -d --build
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:18088/health
```

## Improvement Feedback Loop

When an issue is found:

1. Fix the immediate issue in the smallest responsible location.
2. Add or adjust a test, verifier, source-size scan, or API evidence check when practical.
3. Update the owning Markdown artifact if the issue reveals a reusable lesson.
4. Re-run the failed check and the nearest broader gate.
5. Record any residual risk in the handoff.

When a pattern repeats:

- promote it from implementation detail to shared component, shared service, policy, or verifier;
- do not let repeated code become a later splitting project;
- document the promoted pattern in the correct artifact.

## Do Not Do

- Do not treat chat history as stronger than repository evidence.
- Do not add product-specific behavior to the UOK core.
- Do not bypass module manifests for normal module behavior.
- Do not add durable UI outside React + TypeScript source.
- Do not add one-off CSS that bypasses design tokens.
- Do not let a historical target document define current behavior accidentally.
- Do not leave new docs unlinked from the documentation index.
- Do not mark work complete when code passes but the owning policy or module plan is stale.

## Completion Definition

A UOK development task is complete only when:

- code is in the correct owner boundary;
- docs reflect current behavior and accepted policy;
- tests and candidate gates relevant to the change pass;
- source size and naming checks do not reveal avoidable drift;
- local runtime evidence is collected when runtime behavior changes;
- remaining limitations are stated plainly.

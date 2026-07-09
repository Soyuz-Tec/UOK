# UOK AI Worker Development Model

**Status:** Mandatory development governance model.

**Current candidate:** `UOK-3.1.0-alpha.3`

## Purpose

UOK may use AI workers to improve development throughput, review depth, UI validation, documentation consistency, and release evidence. These workers are development assistants only. They do not replace repository authority, UOK permissions, GitHub guardrails, human approval, or future governed runtime behavior in `agents.core`.

## Authority

AI worker output is advisory until the coordinator verifies it against:

1. repository files and module manifests;
2. tests, builds, local runtime evidence, and Git/GitHub state;
3. `AGENTS.md`, `docs/ARCHITECTURE.md`, this documentation index, and affected module or policy docs;
4. UOK security, operations, UI, source-size, and GitHub publication gates.

Do not add more workers to compensate for unclear authority. First clarify the repo state, target branch, runtime target, and owning docs.

## Activation Levels

| Level | Use when | Worker shape |
|---|---|---|
| Single-worker mode | Small focused code, test, or documentation changes | One coordinator implements and verifies |
| Review-pass mode | The change affects UI, security, data contracts, module boundaries, or release evidence | One implementer plus a specialist review or validation pass |
| Parallel-worker mode | Work is clearly separable and benefits from independent inspection | Coordinator plus backend, frontend, UI, audit, security, or documentation specialists |

## Standard Worker Roles

| Role | Responsibility |
|---|---|
| Coordinator / repo steward | Confirms root, branch, upstream, docs, scope, final diff, verification, commit, and publication readiness |
| Backend developer | Python module behavior, API routes, command handlers, migrations, schedule logic, backend tests |
| Frontend developer | React, TypeScript, Vite, generated contracts, shared primitives, frontend tests |
| UI designer | Workspace anatomy, interaction density, semantic tokens, accessibility, visual consistency |
| UI validator | Playwright proof, screenshots, focus, keyboard paths, light/dark/system appearance, responsive checks, console cleanliness |
| Auditor | Source size, module boundaries, docs consistency, test adequacy, reviewability, quality scorecard |
| Security/ops verifier | Auth, permissions, auditability, secrets, dependency posture, rollback, `uok_ops.ps1`, GitHub readiness |
| Documentation steward | Architecture docs, ADRs, module plans, operations docs, documentation index, PR evidence |

## Handoff Protocol

Every specialist worker must report:

- files inspected;
- scope touched;
- proposed or completed work;
- verification run or reason not applicable;
- risks and unresolved questions.

The coordinator must collapse worker output into one repo-governed change plan or review result. No worker can mark UOK work complete without relevant checks or a stated verification gap.

## Verification Matrix

| Change type | Minimum evidence |
|---|---|
| Backend/module behavior | Python compile, affected pytest, module boundary or module verifier when applicable |
| Frontend/UI behavior | TypeScript build, frontend tests where applicable, UI proof for user-facing workspace changes |
| Runtime/deployment behavior | Rebuild, `/health` smoke, candidate verifier when applicable |
| Security/operations | Permission checks, audit event review, dependency audit, rollback path |
| Publication | GitHub preflight, GitHub readiness, clean diff, no `var/` evidence or secrets |

## Failure And Escalation

Stop or escalate when:

- upstream branch has diverged;
- verification fails and the failure is not intentionally deferred;
- auth, authorization, auditability, or dependency security is weakened;
- secrets or local-only evidence would be published;
- a material architecture decision lacks ADR or policy coverage;
- workers disagree because repo authority is unclear.

## Validation

Run the same gates required by the affected work. For most development changes:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Audit
```

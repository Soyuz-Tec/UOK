# UOK Codex Working Agreements

## Authority

Use this file for all work in this repository. Repository files, tests, Git state, module manifests, and live runtime evidence are stronger than chat history or external memory.

Before non-trivial edits:

1. Confirm the repo root and branch.
2. Fetch or inspect the GitHub upstream branch when network access is available.
3. Read `docs/ARCHITECTURE.md`.
4. Read `docs/DOCUMENTATION_INDEX.md`.
5. Read `docs/architecture/UOK_DEVELOPMENT_CONTINUITY_SYSTEM.md`.
6. Read the active policy or module document affected by the task.

## Mandatory Policies

- Naming: `docs/architecture/UOK_NAMING_CONVENTIONS.md`
- Architecture: `docs/ARCHITECTURE.md`
- Module contract: `docs/architecture/UOK_MODULE_EXTENSION_CONTRACT.md`
- Language stack: `docs/architecture/UOK_PROGRAMMING_LANGUAGE_STACK_POLICY.md`
- Code quality and technology audit: `docs/architecture/UOK_CODE_QUALITY_AND_TECHNOLOGY_AUDIT_STANDARD.md`
- Internal engineering system: `docs/architecture/UOK_INTERNAL_ENGINEERING_SYSTEM.md`
- AI worker development model: `docs/architecture/UOK_AI_WORKER_DEVELOPMENT_MODEL.md`
- UI design: `docs/design/UOK_UI_DESIGN_POLICY.md`
- Standard operations: `docs/operations/UOK_STANDARD_OPERATIONS.md`
- GitHub guardrails: `docs/operations/UOK_GITHUB_ENGINEERING_GUARDRAILS.md`

## Implementation Rules

- Keep `src/uok` product-neutral.
- Put module behavior under `modules/<module_name>`.
- Put module-neutral reusable frontend primitives under `web/src/shared`.
- Keep product-neutral shell/shared frontend code in React + TypeScript under `web/src`, and module-specific production frontend code under `modules/<module_name>/web/src`.
- Keep backend and module backend code in Python.
- Keep generated files out of manual edits.
- Split files before they become mixed-responsibility.
- Add or update tests for meaningful behavior changes.
- Apply the UOK Internal Engineering System for policies, checklists, CI gates, review rules, release gates, dashboards, and audit evidence.
- Treat AI worker output as advisory until verified against repo files, tests, runtime evidence, Git/GitHub state, and UOK gates.
- Update the owning Markdown artifact when a rule, workflow, boundary, or durable lesson changes.

## Required Local Checks

Run the narrowest relevant check during development, then the broader gate before handoff or publication:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action EngineeringEvidence
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Audit
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```

For runtime changes, rebuild and smoke the local Podman stack:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Rebuild
```

## GitHub

GitHub is the shared UOK source of truth for code, documentation, tests, workflows, deployment definitions, and team synchronization.

For normal UOK development, complete verified work should be prepared for commit and push without waiting for a repeated reminder. Do not publish only when the user explicitly asks for a local-only experiment, when the work is incomplete, when verification is failing, when the remote branch has moved and needs reconciliation, or when local-only evidence, secrets, or unsafe artifacts would be included.

Before commit, push, or PR:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action GithubPreflight
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action GithubReadiness
```

Do not commit local evidence under `var/`.

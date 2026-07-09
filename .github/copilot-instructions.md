# UOK Repository Instructions

Use `AGENTS.md` as the first local instruction file for coding-agent work.
Use `docs/architecture/UOK_AI_WORKER_DEVELOPMENT_MODEL.md` when AI worker or specialist review roles are involved; worker output is advisory until verified against repo files, tests, runtime evidence, Git/GitHub state, and UOK gates.

Before non-trivial implementation:

1. Confirm repo root, branch, Git state, and runtime target.
2. Fetch or inspect the GitHub upstream branch when network access is available.
3. Read `docs/ARCHITECTURE.md`.
4. Read `docs/DOCUMENTATION_INDEX.md`.
5. Read `docs/architecture/UOK_INTERNAL_ENGINEERING_SYSTEM.md`.
6. Read the policy or module document affected by the task.

GitHub is the shared UOK source of truth for code, documentation, tests, workflows, deployment definitions, and team synchronization. Completed verified work should be prepared for commit and push unless the user explicitly asks for local-only work or publication is blocked by failing checks, upstream divergence, incomplete work, secrets, or local-only artifacts.

Implementation rules:

- Keep `src/uok` product-neutral.
- Put module behavior under `modules/<module_name>`.
- Keep durable frontend code in React + TypeScript under `web/src`.
- Put reusable module-neutral frontend primitives under `web/src/shared`.
- Keep generated files out of manual edits.
- Keep source files reviewable and split mixed responsibilities early.
- Update the owning Markdown artifact when a boundary, workflow, rule, or durable lesson changes.

Expected verification:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Audit
```

For candidate-level handoff, use:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```

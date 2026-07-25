# Contributing to UOK

**Status:** Active contributor guide
**Target:** UOK 3.1.0 alpha
**Purpose:** Keep contributions reviewable, architecture-safe, and supported by executable evidence.
**Scope:** Source, tests, documentation, workflows, deployment definitions, and module extensions.

## Before You Start

UOK is a Python/FastAPI and React/TypeScript modular monolith. Read these files
before changing behavior:

1. `AGENTS.md`
2. `docs/ARCHITECTURE.md`
3. `docs/DOCUMENTATION_INDEX.md`
4. `docs/architecture/UOK_DEVELOPMENT_CONTINUITY_SYSTEM.md`
5. The policy, module plan, or operations guide that owns the change

Use Python 3.14, Node.js 26, npm 11, PostgreSQL 18, PowerShell 7 or Windows
PowerShell 5.1, Git, GitHub CLI, and Podman for the supported local workflow.

## Development Workflow

1. Start from current `main` and create a focused branch.
2. Keep product-neutral host and kernel behavior under `src/uok`.
3. Keep capability behavior, data, UI, migrations, tests, and verification
   under `modules/<module-name>`.
4. Record material architecture, security, data, public API, or deployment
   decisions in an ADR.
5. Add tests for meaningful behavior and update the owning Markdown artifact.
6. Do not commit secrets, local databases, generated runtime evidence, or
   files below `var/`.

Run focused checks during development. Before publication, run the standard
sequential gate:

```powershell
.\scripts\uok_ops.ps1 -Action TechnologyAudit
.\scripts\uok_ops.ps1 -Action EngineeringEvidence
.\scripts\uok_ops.ps1 -Action Audit
.\scripts\uok_ops.ps1 -Action Verify
.\scripts\uok_ops.ps1 -Action GithubPreflight
.\scripts\uok_ops.ps1 -Action GithubReadiness
```

Run local test-state-mutating gates sequentially. Parallel test workflows can
contend for the repository test database.

## Pull Requests

- Keep each pull request focused on one coherent outcome.
- Explain scope, architecture and data impact, verification, risk, and rollback.
- Resolve review conversations and keep required checks green.
- Request review from the owners in `.github/CODEOWNERS`.
- Do not merge a release-affecting change without independent approval once an
  independent maintainer is configured.

The pull request template is the minimum handoff record, not a substitute for
tests or runtime evidence.

## Security Reports

Do not open a public issue for a suspected vulnerability. Follow
`SECURITY.md`.

## Validation

This guide is validated by the documentation-reference and repository policy
checks. Changes to the workflow must update the relevant engineering and
operations policies in the same pull request.

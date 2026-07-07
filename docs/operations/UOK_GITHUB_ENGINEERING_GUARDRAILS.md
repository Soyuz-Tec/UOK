# UOK GitHub Engineering Guardrails

**Status:** Mandatory GitHub preparation guide.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Applies to:** GitHub repository settings, pull requests, ownership review, dependency monitoring, OpenSSF Scorecard, required checks, and engineering evidence.

## Purpose

This guide translates the UOK Internal Engineering System into GitHub-facing controls. It supports the SLSA and OpenSSF Scorecard direction without claiming formal certification.

## Source Of Truth Policy

GitHub is the shared UOK source of truth for code, documentation, tests, workflows, deployment definitions, and team synchronization.

Completed verified work should be synchronized through GitHub without requiring a repeated reminder. Keep work local only when the user explicitly asks for local-only experimentation, when verification is failing, when the branch needs upstream reconciliation, or when the change would publish local-only evidence, secrets, personal data, database dumps, or unsafe artifacts.

Before substantial work and before publication, `GithubPreflight` must inspect the upstream branch so a local checkout does not silently drift from the team source of truth.

## Repository Files

| File | Purpose |
|---|---|
| `.github/CODEOWNERS` | Assign review ownership for architecture, source, modules, scripts, workflows, and docs |
| `.github/dependabot.yml` | Schedule dependency update checks for Python, npm, GitHub Actions, and Docker |
| `.github/workflows/uok-ci.yml` | Main CI gate for compile, tests, audits, module contract, source-size, PostgreSQL 18 baseline, frontend tests, and build |
| `.github/workflows/uok-openssf-scorecard.yml` | OpenSSF Scorecard security-health workflow |
| `.github/pull_request_template.md` | PR checklist for scope, architecture impact, verification, review rules, risk, and rollback |
| `.github/copilot-instructions.md` | GitHub-native coding-agent instructions aligned with `AGENTS.md` |

## Required GitHub Settings

Apply these in GitHub repository settings after the current branch is pushed:

1. Protect the main development branch.
2. Require pull requests before merging.
3. Require CODEOWNERS review.
4. Require the `candidate-checks` workflow to pass.
5. Require the OpenSSF Scorecard workflow or review its output before release.
6. Require conversation resolution before merge.
7. Block force pushes and branch deletion on protected branches.
8. Require linear history if it does not conflict with the team's release workflow.

These are repository-admin settings; they cannot be fully enforced by local files alone.

## Required Local Preflight

Before commit, push, or pull request:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action GithubPreflight
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Audit
```

Before candidate handoff:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```

## Engineering Evidence

Generate local engineering evidence with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action EngineeringEvidence
```

Evidence is written under:

```text
var/evidence/engineering/
```

The `var/` folder is local-only and ignored by Git. Promote only sanitized summaries into Markdown when needed.

## Release Evidence Checklist

Before release or candidate promotion, preserve:

- CI result for `.github/workflows/uok-ci.yml`;
- OpenSSF Scorecard result;
- local `TechnologyAudit` output;
- local `Audit` output;
- local `Verify` output;
- module contract output;
- source-boundary and naming gate output;
- dependency audit output;
- local runtime `/health` result after rebuild;
- backup/restore or ASUH event evidence when operations changed.

## Limitations

Local repository files can prepare GitHub guardrails, but branch protection, required checks, and CODEOWNERS enforcement require GitHub repository settings after push.

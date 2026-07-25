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
| `.github/workflows/uok-ci.yml` | Main CI gate for compile, lint, scoped type checks, measured coverage, tests, audits, module contract, source-size, digest-pinned PostgreSQL 18.4, hosted Chromium proof, exact-image Trivy scan, and build |
| `.github/workflows/uok-openssf-scorecard.yml` | OpenSSF Scorecard security-health workflow |
| `scripts/github_actions_policy.py` | Fail-closed repository-wide validation that external workflow actions use immutable commit references |
| `.github/pull_request_template.md` | PR checklist for scope, architecture impact, verification, review rules, risk, and rollback |
| `.github/copilot-instructions.md` | GitHub-native coding-agent instructions aligned with `AGENTS.md` |

Every external action or reusable workflow in `.github/workflows/*.yml` and
`.github/workflows/*.yaml` must use an exact lower-case 40-character commit
SHA. Tags, branches, short SHAs, mixed-case SHAs, expressions, and container
action references do not satisfy this control. Repository-local `./` actions
remain allowed without a remote commit reference.

The hosted PostgreSQL service is also pinned to its reviewed OCI index digest.
After the candidate image is built once as `uok-ci:${GITHUB_SHA}`, pinned Trivy
scans that exact local image and fails on `HIGH` or `CRITICAL` vulnerabilities,
including findings with no published fix. The JSON scan report is retained as
CI evidence. This hosted pin does not change the shared local compose database.

## Repeatable GitHub Operations

UOK automates the GitHub operations that were previously manual:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action GithubReadiness
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action GithubSecuritySetup
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action GithubPrChecks -PullRequestNumber <number> -WatchChecks
```

`GithubReadiness` checks authentication, repo metadata, upstream sync, latest branch runs, PR status, Dependabot alerts, and whether branch protection or rulesets are available.

`GithubSecuritySetup` enables Dependabot vulnerability alerts, enables
Dependabot security updates, configures merge hygiene, and reads back whether
protected-branch enforcement can be applied.

`GithubPrChecks` shows or watches PR checks so CI and Scorecard status can be verified without manually opening GitHub.

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

These are repository-admin settings; they cannot be fully enforced by local
files alone.

## Current Effective Configuration

As read back from GitHub on 2026-07-24, the public repository has an active
`UOK main protection` ruleset (`19711488`) on the default branch. It requires pull requests,
linear history, resolved review conversations, `candidate-checks`, OpenSSF
Scorecard, and all three CodeQL analysis checks (`actions`, `python`, and
`javascript-typescript`). It blocks deletion and non-fast-forward updates and
permits only squash or rebase merge.

Secret scanning, push protection, private vulnerability reporting, immutable
releases, and CodeQL default setup with the extended query suite are enabled.
The repository currently has only one human collaborator, so required approval
and CODEOWNER review remain disabled rather than being misreported as
independent review. Keep the governance issue open until a second independent
maintainer exists; then require one approval, CODEOWNER review, and approval
from someone other than the last pusher.

Exact retrieval handles:

```powershell
gh api repos/Soyuz-Tec/UOK/rulesets/19711488
gh issue view 3 --repo Soyuz-Tec/UOK
```

The open governance dependency is
[`#3`](https://github.com/Soyuz-Tec/UOK/issues/3). Re-read both handles before
claiming the configuration is current.

## Required Local Preflight

Before commit, push, or pull request:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action GithubPreflight
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Audit
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action GithubReadiness
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
var/evidence/coverage/python/
var/evidence/coverage/frontend/
var/evidence/security/
```

The `var/` folder is local-only and ignored by Git. Promote only sanitized summaries into Markdown when needed.

The exact CI measurement scopes, baseline floors, browser boundary, timeouts,
and retention policy are defined in `docs/operations/UOK_CI_QUALITY_GATES.md`.

## Release Evidence Checklist

Before release or candidate promotion, preserve:

- CI result for `.github/workflows/uok-ci.yml`;
- OpenSSF Scorecard result;
- `GithubReadiness` output;
- `GithubPrChecks` output for the integration PR;
- local `TechnologyAudit` output;
- local `Audit` output;
- local `Verify` output;
- module contract output;
- source-boundary and naming gate output;
- dependency audit output;
- retained Python and frontend coverage artifacts plus their enforced floors;
- retained exact-image Trivy JSON and its high/critical gate result;
- hosted Chromium UI proof result;
- local runtime `/health` result after rebuild;
- backup/restore or ASUH event evidence when operations changed.

## Limitations

Local repository files can prepare GitHub guardrails, but effective rules and
security settings remain GitHub state. Independent human approval and
CODEOWNERS enforcement also require a second real maintainer; UOK must not
simulate that actor or claim the gate before one exists.

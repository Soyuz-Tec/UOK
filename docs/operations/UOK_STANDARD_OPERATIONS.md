# UOK Standard Operations

**Status:** Mandatory local operations runbook.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Applies to:** local verification, audits, UI proof automation, folder organization checks, GitHub preparation, PostgreSQL connection capacity, backup and restore, Podman rebuilds, and repeatable incident drills.

## Purpose

UOK needs repeatable operations so development quality does not depend on memory or ad hoc terminal history. This runbook standardizes the commands and evidence expected before code expansion, candidate promotion, GitHub publication, database restore testing, and ASUH incident drills.

The operating model is defined by `docs/architecture/UOK_INTERNAL_ENGINEERING_SYSTEM.md`: policies, checklists, CI gates, code review rules, release gates, dashboards, and audit evidence.

The executable entry point is:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action <Action>
```

## Standard Actions

| Action | Purpose | Command |
|---|---|---|
| `TechnologyAudit` | Focused code-quality, line-of-code, stack, dependency, module-shape, and operations hygiene audit | `.\scripts\uok_ops.ps1 -Action TechnologyAudit` |
| `EngineeringEvidence` | Generate local engineering-system evidence and quality scorecard under `var/evidence/engineering` | `.\scripts\uok_ops.ps1 -Action EngineeringEvidence` |
| `UiProof` | Run the Playwright UI proof gate against the Vite workspace, including Planning Gantt layout, keyboard, appearance, responsive, screenshot, and console checks | `.\scripts\uok_ops.ps1 -Action UiProof` |
| `Audit` | Deterministic isolated Python tests plus code, dependency, source-size, naming, module contract, and folder organization checks | `.\scripts\uok_ops.ps1 -Action Audit` |
| `Verify` | Full audit plus frontend tests, static build, UI proof, and candidate verifier | `.\scripts\uok_ops.ps1 -Action Verify` |
| `Rebuild` | Rebuild and start local Podman stack on `127.0.0.1:18088` | `.\scripts\uok_ops.ps1 -Action Rebuild` |
| `Health` | Check local candidate `/health` | `.\scripts\uok_ops.ps1 -Action Health` |
| `DatabaseCapacity` | Load the committed capacity policy, enforce its offline budget, and verify cluster-wide live PostgreSQL capacity, role safety, and grouped sessions | `.\scripts\uok_ops.ps1 -Action DatabaseCapacity` |
| `PlanningReleaseReadiness` | Run Gate E candidate, PostgreSQL scale, recovery, live Chromium, observability, compatibility, and engineering-evidence checks | `.\scripts\uok_ops.ps1 -Action PlanningReleaseReadiness` |
| `ContactsVerifierGroupCleanup` | Dry-run and, only with a reviewed v2 plan, backup, and double confirmation, remove an exact legacy verifier membership and archive the now-empty audited group | `.\scripts\uok_ops.ps1 -Action ContactsVerifierGroupCleanup` |
| `BackupDb` | Create local PostgreSQL 18 custom-format dump | `.\scripts\uok_ops.ps1 -Action BackupDb` |
| `RestoreDb` | Restore a local dump into the local stack, guarded by explicit confirmation | `.\scripts\uok_ops.ps1 -Action RestoreDb -BackupPath <dump> -ConfirmRestore` |
| `AsuhTest` | Create a local ASUH incident event and run health plus candidate verifier | `.\scripts\uok_ops.ps1 -Action AsuhTest -IncidentReason "reason"` |
| `GithubPreflight` | Show branch, remote, latest commit, diff hygiene, and changed files before commit/push/PR | `.\scripts\uok_ops.ps1 -Action GithubPreflight` |
| `GithubReadiness` | Check GitHub auth, repo metadata, upstream sync, latest branch runs, current PR status, Dependabot alerts, and enforcement availability | `.\scripts\uok_ops.ps1 -Action GithubReadiness` |
| `GithubSecuritySetup` | Enable Dependabot alerts/security updates, configure merge hygiene, and report branch-protection/ruleset availability | `.\scripts\uok_ops.ps1 -Action GithubSecuritySetup` |
| `GithubPrChecks` | Show or watch PR checks for the current branch or a supplied PR number | `.\scripts\uok_ops.ps1 -Action GithubPrChecks -PullRequestNumber <number> -WatchChecks` |

The script is a convenience wrapper. Shared PowerShell operation helpers live in `scripts/uok_common_ops.ps1`; operation scripts should dot-source that helper instead of copying `Invoke-UokStep` or native-command handling. The underlying commands remain visible and may be run directly when debugging.

Local `Audit` and GitHub CI both invoke `python scripts/run_python_tests.py`. The runner discovers the root suite and every module test path, rejects missing paths and duplicate resolved files, then runs each file sequentially in a fresh subprocess with ambient pytest options and plugin auto-loading disabled so shared SQLite state or machine-global pytest configuration cannot make aggregate discovery order-dependent. Independent modules may reuse ordinary test filenames. Use `--check` to validate discovery only or `--list` to inspect the exact ordered suite.

Developer verification installs `requirements-dev.txt`; OCI build and runtime stages continue to
install runtime-only `requirements.txt`. Verify both generated API artifacts without modifying the
working tree:

```powershell
python -m pip install -r requirements-dev.txt
python -m pip_audit -r requirements-dev.txt
npm --prefix web run check:contracts
$env:PYTHONPATH = "src"
python -c "from uok.module_release_contract import validate_module_release_contracts; r=validate_module_release_contracts(); assert r['ok'], r; print(r)"
```

The contract check renders FastAPI OpenAPI and `openapi.d.ts` into a temporary directory, compares
both with `web/src/generated`, and exits nonzero on drift. Regenerate intentionally with
`npm --prefix web run generate:api`, review the diff, then rerun the check.

The module release contract adds module-owned test and verifier evidence to the runtime manifest
contract. Application startup uses the runtime scope so OCI images may omit `modules/*/tests`;
local Audit, CI, and candidate catalog discovery use the release scope before publication.
OCI stages run `python scripts/validate_container_module_assets.py --require-tests-excluded` after
copying source. That gate discovers runtime-proven verifiers from validated manifests, checks their
exact module-owned paths, enforces the canonical `modules/<module_name>/tests` declaration, and
fails if module test directories entered the image.

Candidate discovery recursively preflights every statically dot-sourced PowerShell helper before
loading a module script. Helper imports must be literal `$PSScriptRoot` paths inside the owning
module `verify/` directory or the shared `scripts/verify` directory; dynamic paths, links,
junctions, cycles, duplicate declared functions, and syntax errors fail the run before execution.

When Apps Manager reports `reconciliation_required`, an authorized platform administrator uses the
Apps Manager **Reconcile** action (`POST /api/modules/{module_name}/reconcile`). The operation locks
the organization and module record, preserves module data, refreshes control-plane manifest truth,
and emits one `ModuleLifecycleReconciled` audit event. Repeating the action is a no-op.

## Required Verification Levels

### Fast Check

Use before small docs or source edits:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Audit
```

Use `TechnologyAudit` alone when the change only affects stack policy, quality rules, source organization, or operational guardrails.

### Candidate Check

Use before local candidate handoff or GitHub publication:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```

Use this focused gate when the frontend shell or module workspace changes:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action UiProof
```

### Source Candidate Package

Build a source package from one explicit Git commit after the candidate checks pass:

```powershell
python .\scripts\package_uok_candidate.py --version 3.1.0-alpha.3 --source-ref HEAD
```

The packager resolves the supplied revision to a commit before reading any source. It reads
regular tracked blobs directly from that commit, never from dirty or untracked working-tree
content. Packaging fails closed when the commit contains a non-regular Git entry, a
case-colliding or extraction-unsafe path, a local/generated path, or a sensitive filename.

Every archive contains `UOK_PACKAGE_MANIFEST.json` with the package version, resolved source
commit, and deterministic SHA-256 plus size and Git mode for every packaged source file. Verify
that manifest commit against the intended reviewed commit before distributing the archive. Use
`--commit <revision>` as an alias for `--source-ref <revision>` when automation already uses
commit terminology.

### Live Runtime Check

Use when the running app, container image, database, or UI bundle changed:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Rebuild
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action DatabaseCapacity
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```

For the complete Planning Gate E production-like local profile after rebuild:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action PlanningReleaseReadiness
```

The owned evidence composition and its non-production boundary are defined in
`docs/operations/UOK_PLANNING_RELEASE_READINESS.md`.

The database pool settings, capacity formula, recovery checks, and future external-pooler boundary
are defined in `docs/operations/UOK_DATABASE_CONNECTION_POOLING.md`.

Contacts verifier-group hygiene, exact empty/legacy-one-member audit criteria, API membership removal, archive execution, and per-group/database rollback are defined in `docs/operations/UOK_CONTACTS_CORE_OPERATIONS.md`. The cleanup action is a dry run unless a reviewed v2 plan, a non-empty backup, and both execution switches are supplied.

## Folder Organization Standard

The audit action checks that core documentation anchors exist and every module manifest has the required folder shape:

```text
modules/<module_name>/
  manifest.yaml
  backend/
  web/
  migrations/
  tests/
```

Module code must stay module-owned. Shared module-neutral UI, table controls, search controls, pop-ups, inline editing, and workflow primitives belong under `web/src/shared`.

## GitHub Standard

GitHub is the shared UOK source of truth for code, documentation, tests, workflows, deployment definitions, and team synchronization. Local runtime state, generated evidence, local database dumps, and temporary files remain local-only unless a future task explicitly promotes a sanitized artifact.

Use GitHub by default for completed verified development work. A UOK task should remain local-only only when:

- the user explicitly asks for a local-only experiment;
- the work is incomplete or exploratory;
- verification is failing;
- the local branch is behind or otherwise diverged from upstream;
- publication would include secrets, personal data, local evidence, database dumps, or unsafe artifacts.

Before substantial work, inspect the target branch and upstream state:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action GithubPreflight
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action GithubReadiness
```

Before commit, push, or PR:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action GithubPreflight
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action EngineeringEvidence
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action GithubReadiness
```

GitHub publication should include:

- clean intentional diff;
- no generated runtime artifacts from `var/`;
- UOK Internal Engineering System alignment clear in the PR;
- source-size guardrail clean;
- module contract clean;
- source-boundary and naming clean;
- Python and frontend dependency audits clean;
- Playwright UI proof clean when frontend behavior changed;
- candidate verifier clean;
- engineering evidence includes a quality scorecard with no unreviewed category drift;
- PR description covering scope, architecture impact, tests, risk, and rollback.
- PR checks passing through `GithubPrChecks` or GitHub Actions.

The GitHub Actions workflow `.github/workflows/uok-ci.yml` remains the remote verification baseline.

GitHub-facing controls are detailed in `docs/operations/UOK_GITHUB_ENGINEERING_GUARDRAILS.md`.

### GitHub Readiness And PR Check Commands

Use this after pushing a branch or before reviewing a PR:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action GithubReadiness
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action GithubPrChecks -PullRequestNumber 2
```

Use this when a PR is actively running checks:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action GithubPrChecks -PullRequestNumber 2 -WatchChecks
```

Use this when preparing a repository or rechecking GitHub settings:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action GithubSecuritySetup
```

`GithubSecuritySetup` is intentionally idempotent for Dependabot alerts, Dependabot security updates, and merge hygiene. If GitHub blocks private-repo branch protection or repository rulesets on the current plan, the command reports the blocker and leaves issue tracking as the fallback.

## PostgreSQL Connection Capacity

Before building or deploying, run the credential-free offline gate from the
canonical committed policy:

```powershell
python scripts/verify_database_capacity.py --environment-file deploy/database-capacity.env
```

After the stack is running, verify the same policy against cluster-wide live
PostgreSQL state:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action DatabaseCapacity
```

`Rebuild` loads `deploy/database-capacity.env` and runs the offline gate before
Compose starts. After health succeeds, it uses a one-shot, bounded-timeout,
read-only live connection inside the API container. Live mode replaces offline
database-limit assumptions and fails if UOK sessions exceed declared app
demand, non-UOK client sessions exceed the direct-tool reserve, or actual
remaining connections fall below operational headroom.

## PostgreSQL Backup

Backups are local-only and ignored by Git under `var/`.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action BackupDb
```

Default output:

```text
var/backups/postgres/uok_pg18_<timestamp>.dump
```

To choose a path:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action BackupDb -BackupPath C:\UOKBackups\uok_pg18.dump
```

## PostgreSQL Restore

Restore is intentionally guarded because it changes local database state.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action RestoreDb -BackupPath .\var\backups\postgres\<dump-file>.dump -ConfirmRestore
```

The restore action:

1. Stops the API container.
2. Copies the dump into the database container.
3. Runs `pg_restore --clean --if-exists`.
4. Restarts the API container.
5. Runs `/health`.

Do not run restore against non-disposable data without an external backup and explicit approval.

## Podman Rebuild

The local candidate stack is:

```powershell
podman compose -p uok -f deploy\compose-local-18088.yaml up -d --build
```

The standardized wrapper is:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Rebuild
```

This uses PostgreSQL 18 and serves UOK at:

```text
http://127.0.0.1:18088/
```

## Source Boundary And Naming

Source-boundary and naming are release gates. Product-specific source must not leak into `src/uok`, and only accepted UOK naming forms are allowed.

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Audit
```

If a naming check fails in Markdown, fix the document rather than weakening the policy.

## ASUH Incident Drill

ASUH means Application/System UOK Health for local candidate testing. It is a standardized local incident drill, not a production alerting system.

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action AsuhTest -IncidentSeverity warning -IncidentReason "backup restore confidence drill"
```

The action writes a local incident event to:

```text
var/incidents/asuh_<timestamp>.json
```

Then it checks `/health` and runs the candidate verifier. Incident event files are local evidence and are ignored by Git.

See `docs/operations/UOK_ASUH_TEST_EVENTS.md` for schedule and incident trigger rules.

## Evidence Handling

Local evidence belongs under `var/` and must not be committed unless a future task explicitly promotes sanitized evidence into docs.

`EngineeringEvidence` writes a repeatable JSON record with the current quality audit and quality scorecard. Use it after meaningful feature work and before publication so quality trends can be compared without relying on chat history.

Durable standards belong in:

- `docs/operations/`
- `docs/architecture/`
- `docs/design/`
- `docs/modules/<module-name>/`
- `.github/workflows/`
- `.github/pull_request_template.md`
- `.github/CODEOWNERS`
- `.github/dependabot.yml`
- `.github/copilot-instructions.md`

## Failure Handling

When a standardized operation fails:

1. Keep the failing output.
2. Fix the nearest responsible source, test, doc, script, module manifest, or runtime configuration.
3. Re-run the failed action.
4. Re-run the nearest broader action before handoff.
5. Update this runbook if the fix reveals a reusable operational lesson.

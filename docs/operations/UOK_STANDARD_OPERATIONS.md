# UOK Standard Operations

**Status:** Mandatory local operations runbook.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Applies to:** local verification, audits, UI proof automation, folder organization checks, GitHub preparation, PostgreSQL connection capacity and database-security inventory, backup and restore, Podman rebuilds, and repeatable incident drills.

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
| `TechnologyAudit` | Focused code-quality, source-size cap/ratchet, stack, dependency, module-shape, and operations hygiene audit | `.\scripts\uok_ops.ps1 -Action TechnologyAudit` |
| `EngineeringEvidence` | Generate local engineering-system evidence, complete source-size/ratchet report, repository-conformance scorecard, evidence completeness, and trend metrics under `var/evidence/engineering` | `.\scripts\uok_ops.ps1 -Action EngineeringEvidence` |
| `UiProof` | Run the Playwright UI proof gate against the Vite workspace, including Planning Gantt layout, keyboard, appearance, responsive, screenshot, and console checks | `.\scripts\uok_ops.ps1 -Action UiProof` |
| `Audit` | Full local CI-quality lane: Ruff, scoped mypy, sequential Python coverage, database/release policy, frontend lint/type/tests/coverage, dependencies, contracts, source size, naming, and folder organization | `.\scripts\uok_ops.ps1 -Action Audit` |
| `Verify` | Full audit plus static build, UI proof, and isolated candidate verifier | `.\scripts\uok_ops.ps1 -Action Verify` |
| `Rebuild` | Rebuild and start local Podman stack on `127.0.0.1:18088` | `.\scripts\uok_ops.ps1 -Action Rebuild` |
| `Health` | Check local candidate `/health` | `.\scripts\uok_ops.ps1 -Action Health` |
| `DatabaseCapacity` | Load the committed capacity policy, enforce its offline budget, and verify cluster-wide live PostgreSQL capacity, role safety, and grouped sessions | `.\scripts\uok_ops.ps1 -Action DatabaseCapacity` |
| `PlanningReleaseReadiness` | Run Gate E candidate, PostgreSQL scale, recovery, live Chromium, observability, compatibility, and engineering-evidence checks | `.\scripts\uok_ops.ps1 -Action PlanningReleaseReadiness` |
| `ContactsVerifierGroupCleanup` | Dry-run and, only with a reviewed v2 plan, backup, and double confirmation, remove an exact legacy verifier membership and archive the now-empty audited group | `.\scripts\uok_ops.ps1 -Action ContactsVerifierGroupCleanup` |
| `BackupDb` | Create local PostgreSQL 18 custom-format dump | `.\scripts\uok_ops.ps1 -Action BackupDb` |
| `RestoreDb` | Restore a local dump into the local stack, guarded by explicit confirmation | `.\scripts\uok_ops.ps1 -Action RestoreDb -BackupPath <dump> -ConfirmRestore` |
| `AsuhTest` | Create a local ASUH incident event and run health plus candidate verifier | `.\scripts\uok_ops.ps1 -Action AsuhTest -IncidentReason "reason"` |
| `AutoStartInstall` | Install or refresh the owned, user-scoped Windows sign-in and periodic recovery task with its frozen no-build payload | `.\scripts\uok_ops.ps1 -Action AutoStartInstall` |
| `AutoStartStatus` | Read task ownership, last result, maintenance state, and payload integrity without starting Podman | `.\scripts\uok_ops.ps1 -Action AutoStartStatus` |
| `AutoStartVerify` | Run the managed task now and require task result zero plus the expected UOK health identity | `.\scripts\uok_ops.ps1 -Action AutoStartVerify` |
| `AutoStartDisable` | Preserve an intentional maintenance stop across sign-in without uninstalling | `.\scripts\uok_ops.ps1 -Action AutoStartDisable` |
| `AutoStartEnable` | Remove the maintenance-disable marker and allow the next managed recovery | `.\scripts\uok_ops.ps1 -Action AutoStartEnable` |
| `AutoStartUninstall` | Remove only the owned task and installed payload while retaining runtime data and logs | `.\scripts\uok_ops.ps1 -Action AutoStartUninstall` |
| `GithubPreflight` | Show branch, remote, latest commit, diff hygiene, and changed files before commit/push/PR | `.\scripts\uok_ops.ps1 -Action GithubPreflight` |
| `GithubReadiness` | Check GitHub auth, repo metadata, upstream sync, latest branch runs, current PR status, Dependabot alerts, and enforcement availability | `.\scripts\uok_ops.ps1 -Action GithubReadiness` |
| `GithubSecuritySetup` | Enable Dependabot alerts/security updates, configure merge hygiene, and report branch-protection/ruleset availability | `.\scripts\uok_ops.ps1 -Action GithubSecuritySetup` |
| `GithubPrChecks` | Show or watch PR checks for the current branch or a supplied PR number | `.\scripts\uok_ops.ps1 -Action GithubPrChecks -PullRequestNumber <number> -WatchChecks` |

The script is a convenience wrapper. Shared PowerShell operation helpers live
in `scripts/uok_common_ops.ps1`; repository source-size and folder checks live
in `scripts/uok_repository_quality_ops.ps1`. Operation scripts should
dot-source the appropriate helper instead of copying audit loops,
`Invoke-UokStep`, or native-command handling. The underlying commands remain
visible and may be run directly when debugging.

Local `Audit` and GitHub CI both invoke `python scripts/run_python_tests.py --coverage`.
The runner discovers the root suite and every module test path, rejects missing paths and duplicate
resolved files, then runs each file sequentially in a fresh subprocess with ambient pytest options
and plugin auto-loading disabled so shared SQLite state or machine-global pytest configuration
cannot make aggregate discovery order-dependent. Independent modules may reuse ordinary test
filenames. Use `--check` to validate discovery only or `--list` to inspect the exact ordered suite.
`Audit` also runs the direct Ruff, scoped mypy, offline database-security, immutable-release,
frontend lint/type, normal-test, and coverage gates defined by `UOK_CI_QUALITY_GATES.md`.

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

## Legacy password migration

New and reset credentials are Argon2id-only. A legacy 64-hex SHA-256 credential is rejected by
default. Before upgrading a persisted database, count affected users by organization without
reading or exporting the hashes:

```sql
SELECT m.organization_id, count(*) AS legacy_password_count
FROM users AS u
JOIN memberships AS m ON m.user_id = u.id
WHERE u.password_hash ~ '^[0-9A-Fa-f]{64}$'
GROUP BY m.organization_id
ORDER BY m.organization_id;
```

If the count is zero, keep legacy migration disabled. If it is nonzero, take and restore-test a
backup, arrange an approved password-reset or IAM path for inactive users, then set both
`UOK_LEGACY_SHA256_LOGIN_MIGRATION=1` and an explicit UTC
`UOK_LEGACY_SHA256_LOGIN_UNTIL=<timestamp>Z`. Startup rejects missing, malformed, expired, or
more-than-14-day windows. During the bounded window only, a successful legacy login is immediately
rehash-committed as Argon2id before a token is issued. Wrong, disabled, and expired attempts remain
the same generic 401. The deadline is checked on every login, including in a long-running process.

Monitor only the credential-free count above. Promotion requires zero remaining legacy hashes,
removal of both migration variables, a restart, and a successful Argon2 login proof. The committed
Compose configuration intentionally never enables this migration mode.

The application also applies hashed identity and immediate-client buckets. Login failures are
recorded atomically under one process lock; successful login may clear only its identity bucket and
cannot erase the client's accumulated anti-spray failures. Registration attempts remain bounded.
Saturation rejects new keys instead of evicting an unexpired block. This in-memory control matches
the committed single-worker local runtime only; a multi-worker or multi-host deployment must
enforce a shared rate limit at trusted ingress and must not trust client-supplied forwarding
headers directly.
OCI stages run `python scripts/validate_container_module_assets.py --require-tests-excluded` after
copying source. That gate discovers runtime-proven verifiers from validated manifests, checks their
exact module-owned paths, enforces the canonical `modules/<module_name>/tests` declaration, and
fails if module test directories entered the image.

Candidate discovery recursively preflights every statically dot-sourced PowerShell helper before
loading a module script. Helper imports must be literal `$PSScriptRoot` paths inside the owning
module `verify/` directory or the shared `scripts/verify` directory; dynamic paths, links,
junctions, cycles, duplicate declared functions, and syntax errors fail the run before execution.

## Candidate Data Neutrality v1

Candidate verification is not allowed to become business data. Every affected
scenario must leave zero retained user-visible or recoverable Calendar,
Contact, Planning, or Shipment fixtures after both success and failure.

The standard gate enforces this with
`scripts/verify_uok_candidate_isolated.ps1`. It resolves immutable API and
PostgreSQL image IDs from the running `uok` stack, runs the full verifier twice
in two fresh project-scoped stacks, and removes each stack, network, and both
volumes before the pass is accepted. The underlying
`scripts/verify_uok_candidate.ps1` fails closed unless the target health
response identifies an explicitly ephemeral candidate runtime.
Every disposable resource carries an exact GUID run label. Teardown inventories
that label, attempts normal Compose removal, checks exact absence, and limits
any best-effort remediation to the same label. Use
`verify_uok_candidate_isolated.ps1 -Runs 1 -FailAfterVerification` only as the
controlled post-mutation failure-path proof; it must fail while still leaving
zero labelled resources.

Operational acceptance requires:

1. Capture a bounded before-run inventory of the exact fixture identities and
   aggregate children that the scenario can create.
2. Execute cleanup from a guaranteed success-and-failure path. Preserve the
   primary verifier error and report cleanup errors separately; cleanup failure
   fails the candidate gate.
3. Use transaction rollback, disposable isolated qualification state, or an
   explicitly governed verifier-only purge. Ordinary recoverable Delete or
   Archive is not cleanup for this gate.
4. Run the candidate verifier twice against the same immutable API/PostgreSQL
   candidate images. For disposable-state verification, prove after each pass
   that the exact project has zero remaining containers, volumes, and networks;
   this whole-state teardown is the zero-retention proof.
5. Keep module lifecycle state and legitimate operator records outside the
   cleanup scope.

Historical cleanup is a separate reviewed operation. Start with a dry-run
inventory, sort the exact IDs, record the SHA-256 digest of that list, review
all exclusions, and mutate only when the live IDs and digest still match the
approved set. Prefix-only, substring, age-based, or other fuzzy selection must
fail closed. Record post-cleanup counts and rollback or backup evidence
appropriate to the owning module.

When Apps Manager reports `reconciliation_required`, an authorized platform administrator uses the
Apps Manager **Reconcile** action (`POST /api/modules/{module_name}/reconcile`). The operation locks
the organization and module record, preserves module data, refreshes control-plane manifest truth,
and emits one `ModuleLifecycleReconciled` audit event. Repeating the action is a no-op.

## Required Verification Levels

### Target Toolchain Preflight

Run the durable local preflight before development or qualification:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action ToolchainPreflight
```

The wrapper requires Python `>=3.14,<3.15`, Node.js `>=26,<27`, and npm
`>=11,<12`. On Windows it prefers a compatible repository `.venv`, then the
Python launcher, and searches the process plus user and machine `PATH` entries
for a compatible Node.js installation. Selected directories are prepended only
to the current wrapper process so Python invoked by npm uses the same target
environment. Non-Windows hosts prefer `.venv/bin/python` and otherwise validate
the existing `PATH`.

`Audit`, `Verify`, `TechnologyAudit`, `EngineeringEvidence`, `UiProof`,
`Rebuild`, `PlanningReleaseReadiness`, and `AsuhTest` run this check before any
proof or build step. The preflight performs no installation or download and
fails closed on missing, unsupported, prerelease, or ambiguous version output.
Runtime-only health, database backup/restore, database-capacity, auto-start, and
GitHub status actions remain available when a development toolchain is not
needed.

### Fast Check

Use before small docs or source edits:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Audit
```

Use `TechnologyAudit` alone when the change only affects stack policy, quality rules, source organization, or operational guardrails.

Use the focused source-size gate while splitting or adding handwritten source:

```powershell
python scripts/source_size_policy.py
```

It is the single implementation used by local operations and hosted CI. It
checks UOK's physical-line reviewability heuristics, the `300`-line file and
`120`-line production/tooling Python function hard caps, exact expiring
exceptions, and the no-new/no-growth soft-debt ratchet in
`config/source_size_policy.json`. The default mode prints a concise summary
and exits nonzero on a blocking finding; `--json` emits the complete
`uok.source_size_report.v1` report. To review a candidate baseline without
writing it:

```powershell
python scripts/source_size_policy.py --print-baseline
```

Do not accept a generated baseline mechanically. Normal maintenance lowers or
removes resolved maxima. Any added or increased entry needs explicit owner,
reason, and follow-up review. Line count is not runtime-performance evidence.

### Candidate Check

Use before local candidate handoff or GitHub publication:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```

`Verify` is not successful when its behavior assertions pass but it retains a
user-visible or recoverable Calendar, Contact, Planning, or Shipment fixture.
Candidate Data Neutrality v1 requires the repeated-run zero-delta proof defined
above.

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
- source-size hard caps clean, exceptions exact and unexpired, and no new or
  grown soft-warning baseline debt;
- module contract clean;
- source-boundary and naming clean;
- Python and frontend dependency audits clean;
- Playwright UI proof clean when frontend behavior changed;
- candidate verifier clean;
- engineering evidence includes the repository-conformance scorecard,
  evidence completeness, and an explicit unavailable-category list;
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

## PostgreSQL Database Security

Run the credential-free all-table inventory after any ORM mapping, module
manifest, migration, or tenant-ownership change:

```powershell
python scripts/verify_database_security.py
```

This command must classify every mapped table and validate every direct
`organization_id` column. It reports foundation readiness only and must retain
`production_ready: false` while RLS activation remains blocked.

Least-privileged role provisioning, live foundation verification, active RLS
qualification, guessed-ID proof, secret handling, and rollback are governed by
`docs/operations/UOK_DATABASE_SECURITY.md` and ADR-0030. The shared local
candidate is not a provisioning target. Do not enable RLS table-by-table or
infer production tenant isolation from application tests alone.

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
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action AutoStartDisable
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Rebuild
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action AutoStartEnable
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action AutoStartVerify
```

`Rebuild` is an exact-source operation. It refuses a dirty worktree, derives
the application version and lowercase 40-hex Git `HEAD`, passes both into the
image build, and verifies the labels on the running API image before refreshing
the recovery image and task payload. The raw Compose command above is for
troubleshooting only: without the identity environment variables it produces
`development` / `unknown` labels and is not qualification evidence.
When the managed recovery task exists, `Rebuild` also refuses to start unless
the maintenance-disable marker is present and the task is not running. Keep
recovery disabled after any failed rebuild; enable and verify it only after the
new runtime, image labels, volume pins, and refreshed payload pass inspection.

This uses PostgreSQL 18 and serves UOK at:

```text
http://127.0.0.1:18088/
```

Both local services use `restart: unless-stopped`. On Windows, `Rebuild` also
refreshes an installed auto-start payload after the new API image, database
capacity, and health checks pass. It does nothing to auto-start state when the
managed task is not installed.

## Windows Auto-Start And Recovery Watchdog

Install and prove the supported user-scoped recovery path:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action AutoStartInstall
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action AutoStartVerify
```

The owned `\UOK\UOK Podman Auto Start` task runs 30 seconds after the installing
user signs in and repeats every minute by default. Use
`-CheckIntervalMinutes <1-1440>` with `AutoStartInstall` to set a different
reviewed interval. It uses limited privilege, no stored password, bounded native
command timeouts, a pinned Podman connection and Compose provider, an exclusive
lock, and a frozen `%LOCALAPPDATA%` payload. Existing image-pinned UOK containers
are started first; a running-but-unhealthy API receives one bounded restart
after database readiness. Both named data-volume fingerprints must match the
installed contract before recovery, and each existing or newly recovered
container must mount the exact configured named volume at its governed
destination. Frozen Compose is a no-build/no-pull fallback only when a service
container is missing.

Use `AutoStartStatus` for a read-only ownership, task-result, maintenance, and
payload-integrity report. Use `AutoStartDisable` before an intentional maintenance
stop and `AutoStartEnable` to resume recovery. `AutoStartUninstall` removes only
the owned task and payload; it never stops Podman, deletes containers or volumes,
or removes local data or logs.

This is an interactive-user watchdog for rootless Podman, not a pre-login
service or a production boot claim. Full behavior, security boundaries,
troubleshooting, logs, rollback, and reboot acceptance are defined in
`docs/operations/UOK_WINDOWS_PODMAN_AUTOSTART.md`.

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

`EngineeringEvidence` writes a repeatable JSON record with the current quality
audit, the complete `uok.source_size_report.v1` result, stable warning and
ratchet metrics, and repository-conformance scorecard. The scorecard retains
the compatibility fields `overall_score` and `grade`, but they are
repository-conformance aliases rather than maturity or production-readiness
claims.

Coverage, security/supply-chain, and hosted CI/release categories remain
`unavailable` and unscored unless their registered evidence method verifies
them. Runtime efficiency is likewise unavailable until benchmark, latency, and
resource-use evidence is measured at a declared workload and environment;
source size cannot make it available. Control or workflow presence is not
treated as measured coverage, security verification, performance, or a
successful release. The current local
`coverage_combined_v2` method verifies exact tracked-source coverage plus
unchanged clean-HEAD producer provenance and independently corroborated
run-unique coverage artifacts only; security and hosted CI/release stay
unavailable.

From a clean exact-HEAD checkout, build and include a reviewed
`uok.engineering_measurements.v2` file without changing the standard wrapper:

```powershell
python scripts/build_engineering_measurements.py
python scripts/engineering_evidence.py --measurements <measurement-json> --stdout
```

The builder rejects a dirty, wrong, or stale repository, naive time, unknown
keys or methods, caller scores, malformed JSON, path escapes or symlinks,
missing/tampered producer provenance, artifact metadata mismatches, and
incomplete or extra tracked-source inventories. Evidence output uses the
`uok.engineering_evidence.v2` envelope. Migration details are in
`docs/governance/UOK_ENGINEERING_EVIDENCE_V2_MIGRATION.md`.

Use the reported evidence-completeness percentage and unavailable-category list whenever comparing scorecard trends. An unavailable category is never a pass.

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

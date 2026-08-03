# UOK CI Quality Gates

## Local target toolchain

The standard local proof and build wrappers first run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action ToolchainPreflight
```

Run the focused contract and execution regressions after changing tool
selection, version parsing, or preflight wiring:

```powershell
python -m pytest -q -p no:cacheprovider `
  tests/test_toolchain_preflight.py `
  tests/test_toolchain_preflight_behavior.py
```

This fail-closed preflight selects and verifies Python `>=3.14,<3.15`,
Node.js `>=26,<27`, and npm `>=11,<12` without downloading or installing
software. Direct component commands remain useful diagnostics, but they are not
standard local qualification evidence when this preflight has not passed.

**Status:** Active CI quality and measurement runbook.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Applies to:** `.github/workflows/uok-ci.yml`, Python lint and type checks,
backend and frontend coverage, frontend lint and quality-config formatting,
source-size hard caps and review-debt ratchet, hosted Playwright proof, and
retained CI evidence.

## Purpose

The main `candidate-checks` job must measure quality rather than infer coverage
from the presence of tests. These gates start from measured, reviewable
baselines and fail on regression. They do not claim that all Python source is
already statically typed or that local browser proof is production monitoring.

## Python Gates

Run:

```powershell
python -m ruff check src modules tests scripts conftest.py
python -m mypy
python scripts/run_python_tests.py --coverage
```

Ruff enforces syntax/import correctness across the repository. The
`pyproject.toml` per-file exceptions are the explicit pre-gate debt baseline;
new violations outside those files fail.

Mypy initially protects the shared kernel, every module public facade, and the
sequential test runner. Imports below those public surfaces are skipped so this
gate cannot be misreported as whole-backend type coverage. Expand the owned
surface only after the next scope passes without suppressing real errors.

Coverage keeps the repository runner's stable file order, fresh subprocess per
test file, disabled ambient pytest plugins, and per-file test-database reset.
Each subprocess writes an independent data file. The runner combines those
files only after every test passes and writes XML and JSON into a fresh,
run-unique ignored directory. The producer cross-checks JSON totals and every
tracked source against the independently rendered XML before atomically
publishing the canonical artifacts under `var/evidence/coverage/python/`.

The complete 204-file sequential lane measured `87.95%` combined
statement/branch coverage on 2026-07-25: `91.16%` statements
(`16,297 / 17,877`) and `74.46%` branches (`3,163 / 4,248`). Coverage.py
combines statement and branch opportunities for the enforced total. The
non-regression floor is the deliberately rounded-down whole number `87%`.
Exact-head hosted coverage must meet the same floor and retain its JSON/XML
artifacts; this local baseline does not substitute for the required PR run.
The protected GitHub Actions result and retained artifacts for the exact
reviewed SHA are the authoritative shared execution record. Local
`var/evidence/**` output is trusted-runner developer feedback: its run binding
prevents accidental stale or mixed publication, but it is not adversarial
attestation against a principal who can modify the runner or checkout.

## Source-Size Gate

Local `Audit` and GitHub `candidate-checks` invoke the same implementation:

```powershell
python scripts/source_size_policy.py
```

The default output is a concise CI/operator summary; use `--json` when a
consumer needs the complete `uok.source_size_report.v1` payload.

The policy counts physical lines in handwritten Python, TypeScript, TSX, CSS,
PowerShell, and SQL. It enforces a `300`-line hard file cap, a `120`-line hard
cap for production/tooling Python functions, class-specific soft thresholds,
exact generated/vendor exclusions, symlink rejection, and the
`config/source_size_policy.json` no-growth ratchet. Test and candidate-verifier
functions are exempt from function caps, but their files are not exempt.
Migrations are always scanned.

The committed baseline is accepted review debt, not a target and not a blanket
waiver. CI fails when a soft-warning identity is new or grows beyond its
accepted maximum; unchanged and reduced debt passes. A resolved warning
requires removal of its stale baseline entry before the gate returns clean.
An exception must identify one exact path or qualified Python symbol, owner,
reason, tracking issue, expiry date, and elevated maximum. Wildcard, expired,
unused, or incomplete exceptions fail.

These numeric thresholds are UOK reviewability heuristics, not universal
industry-standard values or runtime-performance evidence. Runtime efficiency
remains unavailable in engineering evidence until a registered method verifies
benchmark, latency, and resource use at a declared workload and environment.

## Frontend Gates

Run:

```powershell
npm --prefix web run lint
npm --prefix web run format:check
npm --prefix web run typecheck
npm --prefix web run test
npm --prefix web run test:coverage
```

Biome lint applies a focused correctness baseline to shell, module, test, and
browser TypeScript. The formatter gate covers the quality configuration files;
source-wide formatting is deferred because adopting it would create unrelated
mass churn across hundreds of existing files.

The normal Vitest lane executes all test files, including the performance
budget and two instrumentation-sensitive suites. The coverage lane excludes
only the Contacts search suite and Planning dependency-geometry performance
suite; both remain mandatory in the normal lane. Coverage still inventories
all non-generated shell and module production TypeScript, including the real
`web/src/main.tsx` bootstrap. It cross-checks every summary file and
line/branch denominator against the independently emitted LCOV inventory
before publishing canonical evidence.

The production bundle gate requires at least 12 JavaScript assets, identifies
the exact script referenced by compiled `index.html`, and enforces cumulative,
entry, and largest-deferred raw/gzip ceilings. The 2026-08-03 qualified build
emits 23 JavaScript assets: a 226.06 KiB raw/70.09 KiB gzip entry and a largest
deferred chunk of 225.14 KiB raw/61.04 KiB gzip. This proves compile-time module
workspace splitting while retaining the closed manifest catalog; it is not a
wire-transfer measurement until the static host's compression policy is
qualified separately.

The measured whole-tree frontend baseline and rounded-down non-regression
floors are:

| Metric | Measured baseline | CI floor |
|---|---:|---:|
| Statements | `76.48%` | `76%` |
| Branches | `70.49%` | `70%` |
| Functions | `74.31%` | `74%` |
| Lines | `80.70%` | `80%` |

Raise a floor when the measured baseline improves materially. Lowering a floor
requires a reviewed explanation in the pull request and this runbook.

## Hosted Browser Proof

After the static frontend build, CI starts Uvicorn against the job's disposable
PostgreSQL 18 service, waits for `/health/ready`, and runs
`verify_uok_candidate.ps1 -EphemeralTarget`. The API advertises
`UOK_CANDIDATE_STATE=ephemeral`; the workflow always terminates its recorded
process before continuing and retains the API log when any preceding candidate
step fails. This exercises the built candidate without Podman, without touching
a persistent environment, and without retaining verifier fixtures.

CI installs Chromium and runs the existing Playwright proof against the Vite
development server. Mock-backed browser scenarios are safe for hosted CI, and
the production-like live Planning scenario remains environment-gated and
skipped without `UOK_LIVE_BASE_URL`. CI must not point mutation-heavy candidate
verification at a persistent runtime.

## CI Control And Evidence

The workflow:

- cancels obsolete runs for the same workflow and ref;
- grants read-only repository contents permission;
- pins every third-party action to a reviewed full commit SHA;
- validates the offline database-security inventory and immutable-release
  workflow policy;
- enforces the source-size hard caps, exact exceptions, and no-new/no-growth
  review-debt ratchet through the shared Python policy;
- pins the hosted PostgreSQL 18.4 Alpine service to the reviewed OCI-index
  digest without changing the shared local database deployment;
- applies a 150-minute job timeout, a measured 90-minute ceiling for the
  sequential Python lane, and narrower frontend/build timeouts;
- retains Python and frontend coverage artifacts plus their clean-HEAD
  provenance sidecars for 14 days;
- builds the fail-closed `uok.engineering_measurements.v2` record only after
  both coverage lanes pass and seal unchanged clean-HEAD provenance, verifies
  exact tracked-source inventories, emits the v2 engineering-evidence
  envelope, and retains both records with the coverage artifacts;
- proves the preceding dependency, contract, test, and coverage steps left the
  tracked and untracked non-ignored worktree clean, then requires every
  coverage/measurement/evidence file to be non-empty before an upload that
  fails on an absent evidence set;
- retains the disposable API log for 14 days when candidate verification fails;
- retains Playwright traces and reports for 14 days when browser proof fails;
- scans the exact locally built CI image with pinned Trivy, fails on fixed or
  unfixed `HIGH`/`CRITICAL` vulnerabilities, and retains the JSON report for
  14 days;
- continues to fail closed on Python and npm dependency audits.

Local evidence under `var/` remains ignored. A passing coverage floor is
non-regression evidence, not proof that untested behavior is correct.

## Validation

```powershell
python -m ruff check src modules tests scripts conftest.py
python -m mypy
python scripts/source_size_policy.py
python scripts/verify_database_security.py
python scripts/validate_release_workflow.py
python -m pytest -q tests/test_python_test_runner.py
npm --prefix web run lint
npm --prefix web run format:check
npm --prefix web run typecheck
npm --prefix web run test
npm --prefix web run test:coverage
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
```

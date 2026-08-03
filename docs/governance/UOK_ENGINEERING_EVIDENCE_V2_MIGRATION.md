# UOK Engineering Evidence v2 Migration

**Status:** Active schema and consumer migration.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Purpose:** Bind engineering measurements to current-head, hashed, complete
coverage artifacts and keep repository conformance distinct from maturity.

**Applies to:** `uok.engineering_evidence.v2`,
`uok.engineering_measurements.v2`, the repository-conformance scorecard, and
the embedded `uok.source_size_report.v1`, and local coverage evidence under
`var/evidence/`.

## Why v2 Is Required

The retired measurement v1 contract accepted a caller-provided score and
free-form source and method labels. Those fields did not prove that an artifact
existed, matched the current commit, or contained the claimed metrics. The v1
engineering-evidence envelope also did not identify that stricter trust
boundary.

Version 2 is fail closed within the registered trusted-runner integrity
boundary. A measurement is accepted only when:

- the repository origin and current lowercase 40-hex Git HEAD match;
- the worktree is clean;
- `observed_at` is a timezone-aware ISO-8601 timestamp;
- the method is exactly the registered local `coverage_combined_v2` method;
- the primary sources are exactly the repository-relative, non-symlink Python
  `coverage.json` and frontend `coverage-summary.json` artifacts, corroborated
  file-by-file by Python XML and frontend LCOV;
- each successful coverage lane sealed a non-symlink provenance sidecar from
  the same unchanged clean origin and HEAD, with bounded timestamps and the
  exact hashes, byte lengths, media types for every primary and corroborating
  artifact, producer method, run binding, trust model, and tracked-source
  inventory hash/count;
- each source's SHA-256, byte length, and JSON media type match the file;
- the normalized coverage inventories exactly equal the tracked production
  Python and frontend sources, including the frontend bootstrap; line/branch
  totals equal their sums and independently emitted XML/LCOV opportunities;
  and
- the JSON contains no unknown schema keys, non-finite numbers, missing
  metrics, path escapes, or unsupported measured categories.

The coverage score is not accepted from a caller. It is the rounded arithmetic
mean of combined line coverage and combined branch coverage. Security and
supply-chain evidence and hosted CI/release evidence remain unavailable
because this local method does not verify those outcomes.
Runtime-efficiency evidence also remains unavailable: source-size findings are
reviewability evidence and cannot substitute for benchmark, latency, and
resource-use measurements at a declared workload and environment.

## Producer Workflow

From a clean checkout at the exact commit:

```powershell
python scripts/run_python_tests.py --coverage
npm --prefix web run test:coverage
python scripts/build_engineering_measurements.py
python scripts/engineering_evidence.py `
  --measurements var/evidence/engineering/uok_engineering_measurements_v2.json `
  --stdout
```

Each lane deletes every stale canonical report and provenance sidecar before
it starts, writes into a newly created run-unique directory, and publishes
canonical reports only after the successful lane passes independent
corroboration. The trusted runner adds the same unpredictable run ID to every
JSON, XML, and LCOV artifact; sealing rejects an absent, old, mixed, or
pre-bound artifact set. The checkout must be full, with no sparse checkout,
`assume-unchanged`, or `skip-worktree` index entries. It seals provenance only
when the clean repository identity did not change. A dirty development-tree
coverage run may still enforce the coverage floor, but it does not emit
evidence that the measurement builder can consume.

The builder reads only the two registered coverage paths and their two
registered provenance paths. It will not build an artifact from a dirty tree,
a mismatched or stale sidecar, a symlink, an alternate method, an incomplete
or extra tracked-source inventory, or caller-supplied totals. Local files
under `var/` remain ignored.

### Trust Boundary

Local coverage provenance protects against accidental stale reuse, mixed or
incomplete publication, hidden Git index state, and post-seal artifact
changes. It is not an authenticity or adversarial-attestation boundary. A
principal able to modify the checkout, runner, or run directory can fabricate
mutually consistent local artifacts. The authoritative shared execution
record is the required GitHub Actions run for the exact commit SHA and its
retained artifacts, subject to workflow review, branch rules, and repository
protections. Release authenticity uses the separately governed GitHub
artifact attestations described in ADR-0032.

## Consumer Migration

| Retired behavior | Required v2 behavior |
|---|---|
| Accept `uok.engineering_measurements.v1` | Reject it and require `uok.engineering_measurements.v2` |
| Trust a caller `score` | Derive the score from verified line and branch integer totals |
| Display free-form `source` and `method` | Verify exact registered sources, producer provenance, hashes, bytes, tracked inventories, media type, and method |
| Emit `uok.engineering_evidence.v1` | Read `uok.engineering_evidence.v2` and its migration metadata |
| Treat a static control as perfect | Cap static control-conformance categories below 100 |
| Infer missing evidence as passing | Preserve `unavailable`, `null` score, and partial completeness |
| Treat a source-size warning list as an ungoverned snapshot | Preserve the complete `uok.source_size_report.v1` scan, hard-cap, exception, and no-growth ratchet state |

Consumers must use `repository_conformance`, evidence completeness, and the
unavailable-category list. Compatibility aliases `overall_score` and `grade`
remain repository-conformance aliases; they are not maturity or production
readiness claims.

## Source-Size Evidence

`EngineeringEvidence` embeds the in-process `uok.source_size_report.v1`
result. Inspect the same complete report from the command line with:

```powershell
python scripts/source_size_policy.py --json
```

The report includes its schema, scanned-file count, blocking hard and ratchet
findings, active-exception count, complete soft findings, and the baseline,
current, new, grown, and resolved debt counts. Stable identities are
`file:<path>` and `function:<path>::<qualified-symbol>`.

`config/source_size_policy.json` is independently reviewed repository policy,
not generated evidence. It accepts existing soft review debt only at its
recorded maxima. New or grown soft debt and hard-cap breaches remain blocking.
An exception is exact, owned, issue-linked, expiring, and bounded; it remains
visible in the evidence report. Source-size status may inform split-quality
and maintainability review, but it cannot score runtime efficiency.

## Validation

```powershell
python -m pytest -q `
  tests/test_engineering_measurements.py `
  tests/test_engineering_measurement_artifacts.py `
  tests/test_coverage_provenance.py `
  tests/test_quality_scorecard.py `
  tests/test_quality_scorecard_measurements.py `
  tests/test_engineering_evidence.py
python scripts/source_size_policy.py
python scripts/quality_audit.py
```

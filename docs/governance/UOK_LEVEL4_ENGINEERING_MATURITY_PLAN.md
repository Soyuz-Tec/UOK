# UOK Level-4 Engineering Maturity Plan

**Status:** Active implementation plan
**Target:** UOK 3.1.0 alpha to measured-and-controlled engineering maturity
**Purpose:** Convert the July 2026 maturity audit into executable repository, release, security, and operations gates.
**Scope:** Engineering evidence, CI, security, tenant isolation, release supply chain, operations, governance, and qualification.

## Objective

The July 2026 `3.3/5` baseline is a provisional external assessment because
its category inputs, weights, and evidence snapshot were not persisted in a
reproducible repository artifact. The `4.0/5` value remains a planning target,
not an authoritative computed result. The executable exit gates in this plan
are the authoritative definition of gap closure.

Close those gates without weakening UOK's one-repository, one-release,
one-PostgreSQL modular monolith. Do not claim that the numerical target has
been reached until a reviewed, reproducible maturity method is separately
adopted.

This is an internal Level-4 target, not a CMMI, OWASP SAMM, or other formal
certification claim. Existing modular-monolith architecture controls must be
preserved. Security, operations, quality, and governance must each reach
measured-and-controlled evidence rather than being averaged away by stronger
documentation or architecture.

## Workstreams And Exit Gates

| Workstream | Required outcome | Exit gate |
|---|---|---|
| Governance and evidence | Independent review target, accurate active docs, outcome-based metrics | Effective rules require independent review when a second maintainer exists; conformance and maturity are reported separately |
| Quality and CI | Real coverage, lint/type gates, PostgreSQL/browser/Windows proof, bounded feedback | Measurements are retained and ratcheted; exact required checks pass without unexplained warnings |
| Security and tenancy | Production IAM boundary, database tenant defense, least privilege, secure HTTP and secrets | API and database cross-tenant probes pass; critical/high findings are resolved or explicitly accepted |
| Release supply chain | Immutable signed image, SBOM, provenance, scan, prerelease, rollback metadata | Exact commit maps to one verified digest and reproducible release evidence |
| Operations | Readiness/liveness, SLOs, telemetry, alerts, backup/PITR, restore and rollback drills | Declared SLO/RPO/RTO targets pass in production-like staging |
| Qualification | Sustained staging evidence and independent approval | Thirty-day soak, failure drills, two restore exercises, and no open P0/P1 blocker |

## Required Metrics

- line and branch coverage by module and critical path;
- soft size/function findings and ratchet status;
- CI p50/p95 duration and flaky-test rate;
- review participation and time to approval;
- vulnerability count, age, and remediation time;
- release frequency, artifact age, and rollback success;
- availability, latency, error rate, and error-budget consumption;
- recovery time, backup age, restore success, RPO, and RTO.

No category may receive a perfect score from file or workflow presence alone.
Unavailable evidence must be reported as unavailable, not inferred as passing.

## Delivery Rules

Each bounded change follows:

`TechnologyAudit -> EngineeringEvidence -> Audit -> Verify -> Health ->
DatabaseCapacity -> AutoStartVerify -> disposable candidate verification ->
GithubReadiness -> required PR checks`

Test-state-mutating local gates run sequentially. Each change includes its
tests, owning documentation, architecture decision where applicable, risk,
rollback, and exact retrieval handles.

## External Dependencies

The repository cannot manufacture:

- a second independent human maintainer;
- production identity-provider credentials and tenant configuration;
- the final hosting account, DNS, certificates, or offsite backup account;
- business-approved SLO, RPO, RTO, retention, and legal license choices.

Repository work must make those integrations fail closed and ready for an
authorized operator without claiming they already exist.

## Validation

Progress is validated by executable repository metrics, exact-head CI,
qualified runtime evidence, effective GitHub rules, signed release artifacts,
and production-like staging records. Completion is not inferred from this plan
or from a self-reported score.

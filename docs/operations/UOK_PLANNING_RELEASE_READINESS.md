# UOK Planning Release Readiness

**Status:** Mandatory Gate E local closure profile.

**Current candidate:** `UOK-3.1.0-alpha.3`

## Purpose

This profile turns Planning performance, accessibility, recovery,
observability, compatibility, and candidate checks into one repeatable local
operation against the rebuilt PostgreSQL stack.

## Command

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Rebuild
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action PlanningReleaseReadiness
```

The default target is `http://127.0.0.1:18088` and the local `uok` Podman
project. Override `-BaseUrl` only for an explicitly authorized compatible
candidate.

## Included Evidence

1. `/health` response and candidate version.
2. Full modular candidate verifier, including the actor-scoped portfolio and
   its bounded-query diagnostics.
3. Rollback-only PostgreSQL schedule-read, validation, and 100-update batch
   budgets with six samples and zero retained benchmark projects.
4. Persistent negative-float CPM and independent-validation recovery scenario.
5. Two-client PostgreSQL row-lock/concurrency and stale-write recovery scenario.
6. Live Chromium login, Planning/portfolio render, named-button audit,
   diagnostic visibility, page-error check, and console-error check against the
   rebuilt static candidate.
7. Engineering evidence and quality scorecard generation.

## Evidence Boundary

Passing this profile supports `runtime_proven` Gate E closure. It does not
perform a production deployment and does not replace hosted CI, code review,
merge controls, operational monitoring, rollback approval, or the remaining
requirements for the traceability state `production_ready`.

Failure is a release blocker for the current branch. Keep generated evidence
under ignored `var/`; publish only summarized, non-sensitive results in the PR.

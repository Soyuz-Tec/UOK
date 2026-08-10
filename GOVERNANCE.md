# UOK Governance

**Status:** Active governance baseline
**Target:** UOK 3.1.0 alpha
**Purpose:** Define decision, ownership, and review responsibilities as the maintainer group grows.
**Scope:** Repository stewardship, architecture, security, releases, and community changes.

## Current Model

UOK currently uses a maintainer-led model. Repository truth is established by
source, tests, module manifests, active documentation, Git/GitHub state, and
qualified runtime evidence.

`AGENTS.md`, `.github/CODEOWNERS`, `docs/ARCHITECTURE.md`, and
`docs/DOCUMENTATION_INDEX.md` define the detailed authority order.

## Decision Classes

| Decision | Required record |
|---|---|
| Focused implementation within an existing boundary | Pull request with tests and owning documentation |
| Architecture, public API, security, data, or deployment change | ADR plus implementation evidence |
| Release promotion | Successful required checks, signed release evidence, rollback guidance, and maintainer approval |
| Ownership or governance change | CODEOWNERS and this document updated together |

## Review Independence

The review-independence exit gate in
`docs/governance/UOK_LEVEL4_ENGINEERING_MATURITY_PLAN.md` requires:

- at least two independent human maintainers;
- one required approval on protected release branches;
- CODEOWNER review for owned paths;
- no author self-approval as the only human review;
- documented handling of conflicts of interest.

Until a second maintainer is configured, automated rules protect `main`, but
the repository must not claim independent human review.

## Maintainer Responsibilities

Maintainers keep required checks enforceable, review security reports
privately, preserve architecture boundaries, publish accurate release evidence,
and keep active documentation aligned with executable truth.

## Validation

Governance changes require a pull request, effective-rules readback, passing
repository checks, and an update to `.github/CODEOWNERS` when ownership changes.

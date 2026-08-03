# ADR-0034: Python Alpine Runtime Base

**Status:** Accepted

## Context

The exact hosted candidate built from the reviewed
`python:3.14-slim@sha256:cea0e6040540fb2b965b6e7fb5ffa00871e632eef63719f0ea54bca189ce14a6`
input passed application, coverage, browser, and policy gates, but Trivy 0.70
reported 23 release-blocking Debian 13 OS-package findings: four `CRITICAL`
and 19 `HIGH`. None declared a fixed version. The same scanner database found
24 blocking findings in the available Python 3.14 Bookworm slim input.

UOK's release policy intentionally blocks findings without fixes. Suppressing
the findings or setting `ignore-unfixed` would weaken that policy.

## Decision

Use the official multi-platform
`python:3.14-alpine@sha256:26730869004e2b9c4b9ad09cab8625e81d256d1ce97e72df5520e806b1709f92`
OCI index for OpenAPI generation and the final runtime.

The readable tag is retained with the exact index digest. Docker Hub manifest
readback and an independent SHA-256 of the raw OCI index bytes matched. Trivy
0.70 reported zero `HIGH` or `CRITICAL` findings in that exact input.

The runtime continues to use UID/GID 10001, now created with Alpine's
`addgroup` and `adduser`. The image remains a single-worker Python 3.14
container with the same entry point, health check, application dependencies,
OCI identity labels, data volume, and PostgreSQL boundary.

## Consequences

- The final image has a smaller OS package surface and clears the fail-closed
  vulnerability threshold at the reviewed database snapshot.
- Alpine uses musl rather than glibc. Dependency installation, generated API
  parity, the full Python/frontend/browser suite, exact image scanning,
  candidate verification, live database behavior, and SLI targets must pass
  before promotion.
- Physical line limits and image size are not treated as runtime-performance
  proof. Performance remains governed by benchmark, browser, and SLI evidence.
- A future pin refresh must repeat raw-index digest verification and scan the
  exact built image. Moving tags remain prohibited.

## Alternatives

- Keep Debian slim and ignore unfixed findings: rejected because it weakens
  the mandatory release gate.
- Use Python 3.14 slim-bookworm: rejected because the same scanner reported
  more blocking findings.
- Add broad package upgrades or removals to Debian: rejected because no fixed
  versions were available and ad hoc removals could destabilize the runtime.
- Adopt an unrelated distroless or vendor-specific base: deferred because it
  would expand the packaging and operational change beyond the proven need.

## Validation

Acceptance requires:

1. exact OCI index digest readback and independent raw-index SHA-256 match;
2. zero `HIGH` or `CRITICAL` findings in the exact built image;
3. dependency installation and container asset validation;
4. repository `TechnologyAudit`, `Audit`, and `Verify`;
5. both hosted candidate checks at the exact commit;
6. one governed local rebuild with database and volume identity preserved;
7. health, browser, backup/restore, recovery fault, and SLI evidence.

Rollback uses the previously qualified immutable API image while retaining the
PostgreSQL container and named volumes. Do not move a release tag or overwrite
a versioned image.

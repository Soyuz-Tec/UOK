# ADR-0039: Observability, SLOs, and Diagnostic Telemetry

**Status:** Proposed

**Implementation status:** Planned

**Date:** 2026-08-09

**Owners:** Runtime owners

**Relations:** Related to ADR-0036

## Context

UOK exposes health probes, authenticated diagnostics, database-pool snapshots,
and an SLI evidence collector. It does not yet define production service-level
objectives, structured logging fields, request correlation across boundaries,
metrics cardinality policy, tracing, alert ownership, or telemetry retention.
Health alone cannot diagnose latency, saturation, errors, or silent event lag.

## Decision

Adopt product-neutral structured telemetry with organization-safe correlation,
bounded-cardinality RED metrics for HTTP and USE metrics for dependencies,
trace propagation across approved async boundaries, and scrubbed error logs.
Define availability and latency SLIs from user-visible outcomes, then set SLOs,
error budgets, burn-rate alerts, ownership, and runbook links. Telemetry must
never contain tokens, passwords, raw private payloads, or unbounded tenant/user
labels.

## Consequences

Operations can detect and explain failures, but telemetry storage, sampling,
privacy, and alert load require explicit ownership. Instrumentation must remain
optional for local development without changing business behavior.

## Alternatives

- Logs alone were rejected because they do not provide reliable saturation,
  distribution, or service-level measurements.
- Vendor-specific APIs in module code were rejected in favor of a neutral
  host boundary.
- Treating liveness as availability was rejected because it ignores failed
  user operations and dependencies.

## Validation

Require schema tests for redaction and cardinality, trace-correlation tests,
fault-injection evidence for database and downstream failures, dashboard and
alert evaluation against synthetic incidents, and proof that telemetry outage
does not corrupt business transactions.

## Rollback

Instrumentation exporters can be disabled while retaining local structured
logs and health probes. Production must not block user transactions solely
because the telemetry backend is unavailable unless an explicit compliance
control requires fail-closed audit delivery.

## Revisit triggers

Revisit when production targets are set, an observability backend is selected,
event dispatch is implemented, or incident evidence shows the selected SLIs do
not represent user impact.

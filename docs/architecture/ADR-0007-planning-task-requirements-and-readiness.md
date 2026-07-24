# ADR-0007: Planning Task Requirements and Readiness

**Status:** Accepted

**Current candidate:** `UOK-3.1.0-alpha.3`

**Approved:** 2026-07-10

## Context

Planning tasks need explicit approval, evidence, compliance, finance, shipment,
document, and custom requirements. A boolean gate flag cannot represent review
state, decision authority, evidence provenance, or why a task is not ready.
Provider-owned evidence must not be copied into Planning or treated as valid
when its module is unavailable.

## Decision

- Add a Planning-owned task requirement with controlled type and state,
  required/optional intent, due date, optional Planning link, decision actor,
  reason, timestamps, and correlated audit events.
- The workflow is `missing|rejected -> submitted -> under_review`, followed by
  a reasoned `satisfied`, `rejected`, or `waived` decision. Submission and
  review start require `planning.edit`; decisions require
  `planning.gate.approve`.
- Required requirements block readiness unless satisfied or waived. A decided
  requirement with a linked provider also blocks whenever that link is no
  longer `ready`; provider disablement therefore re-blocks the task and project
  without changing Planning history.
- Evidence, document, and shipment requirements may only attach to matching
  typed links and may be satisfied only while the link resolves `ready` for the
  actor. Missing or unavailable providers fail closed. No synthetic Operation
  Graph, shipment, or communication provider is introduced.
- Evidence sources can be attached, replaced, or detached through a dedicated
  audited, ETag-protected command. A changed source invalidates active review or
  satisfied/rejected decisions and requires a new review; detaching a required
  typed source returns the requirement to `missing`.
- Readiness is a derived schedule fact at task and project scope. It contains
  blocker counts and stable Planning requirement IDs, not copied provider
  payloads.
- Requirement changes increment the project revision and affected task version,
  participate in the actor-visible strong ETag, emit module and schedule audit
  events, and enter complete baseline snapshots.
- A Planning link attached to a requirement cannot be removed. The current
  slice has no requirement deletion endpoint; later replacement or archival
  behavior requires an explicit lifecycle decision.
- The Gates inspector exposes create, submit, review, and permission-gated
  decision actions. List/dashboard readiness and the saved `not ready` filter
  use the same server read model.

## Consequences

- Operational readiness is explainable and auditable instead of inferred from
  task status or free text.
- A provider lifecycle or authorization change can change readiness and the
  strong ETag without incrementing the Planning revision.
- Actor-visible readiness may differ when an actor cannot resolve a linked
  source; a denied source is never accepted as evidence.
- Gate C resource constraints remain separate from Gate B requirements and may
  contribute additional readiness facts later.

## Alternatives

- A task-level `gate_complete` flag was rejected because it has no workflow,
  provenance, authority, or multiple-requirement support.
- Copying reports or shipment records into Planning was rejected because it
  bypasses provider authorization, lifecycle, privacy, and retention.
- Treating provider outages as last-known-ready was rejected because readiness
  must fail closed.
- Allowing any typed link to satisfy evidence was rejected because resolver
  readiness alone does not prove semantic compatibility.

## Validation

- additive PostgreSQL 18 migration apply/readback after backup;
- lifecycle, invalid-transition, permission, missing-evidence, wrong-kind,
  linked-source protection, provider-outage, revision/version, and ETag tests;
- command, module-event, and schedule-event correlation proof;
- complete baseline capture and integrity proof;
- typed API, Gates inspector, dashboard/list readiness, and saved-filter tests;
- rebuilt candidate lifecycle and Chromium UI proof.

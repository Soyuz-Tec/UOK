# ADR-0038: Data Retention, Erasure, Legal Hold, and Reference Integrity

**Status:** Proposed

**Implementation status:** Planned

**Date:** 2026-08-09

**Owners:** Data governance owners

**Relations:** Related to ADR-0027

## Context

Contacts defines a module-specific anonymizing purge, while UOK also stores
audit events, command logs, files, calendar records, communications threads,
Planning history, outbox evidence, backups, and cross-module references. There
is no platform retention matrix or shared contract for legal hold, backup
expiry, exported artifacts, or references to erased identities.

## Decision

Define a data-classification and retention matrix before regulated production
data is accepted. Every owner must declare retention basis, minimum/maximum
period, archive behavior, erasure/anonymization action, legal-hold precedence,
cross-module reference projection, backup expiry, and audit evidence. Purge
coordination must be idempotent, organization-scoped, resumable, and fail
closed when an owner cannot prove completion. Immutable security evidence may
retain a non-PII subject tombstone but not recoverable private payloads.

## Consequences

Data lifecycle behavior becomes reviewable and testable across modules, but
owners must classify existing fields and migrations. Backups and derived
exports become part of the erasure claim rather than an implicit exception.

## Alternatives

- Module-only policies were rejected because shared audit, files, backups, and
  references cross module boundaries.
- Immediate hard deletion was rejected because it can break referential and
  audit integrity and can conflict with legal hold.
- Indefinite retention was rejected as an unjustified privacy and security
  risk.

## Validation

Require a machine-readable retention inventory, referential-integrity tests,
hold-versus-purge concurrency tests, backup-expiry proof, restored-backup purge
reconciliation, exported-artifact handling, and evidence that another tenant
cannot trigger or observe the lifecycle.

## Rollback

Lifecycle jobs must support a dry run and resumable checkpoints. Completed
erasure is intentionally irreversible; rollback applies only before destructive
steps and must never reconstruct erased PII from audit or backup shortcuts.

## Revisit triggers

Revisit when accepting this proposal, onboarding regulated data, changing
backup retention, adding a module with personal data, or entering a new legal
jurisdiction.

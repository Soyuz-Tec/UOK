# shipments.core tests

The owner suite covers request/domain rules, immutable facade DTOs, command and
status lifecycle behavior, foreign-owner DTO validation, status history, and
tenant isolation. Root architecture tests separately enforce owner-only
imports and SQL/table boundaries.

The requirement suite additionally covers controlled level/status metadata,
Compliance immutable-DTO validation, optimistic add/update/status/remove,
append-only history, informational summaries, non-blocking Shipment lifecycle,
denied-ID redaction, and cross-tenant isolation without file storage.

The document-instance suite covers bounded metadata validation, lifecycle and
optimistic concurrency, append-only history, owner-local Requirement
association, explicit verified-to-received synchronization, Compliance
immutable-DTO validation, denied-ID redaction, cross-tenant isolation, and
architecture proof that no binary/storage/upload contract exists.

# shipments.core tests

The owner suite covers request/domain rules, immutable facade DTOs, command and
status lifecycle behavior, foreign-owner DTO validation, status history, and
tenant isolation. Root architecture tests separately enforce owner-only
imports and SQL/table boundaries.

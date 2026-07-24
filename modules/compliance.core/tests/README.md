# Compliance Document Type Tests

**Status:** Active module-owned tests.

**Current candidate:** `UOK-3.1.0-alpha.3`

The focused suite covers validation and normalization, tenant-scoped code
uniqueness, immutable name history, optimistic versions, idempotent command
behavior, role enforcement, all legal lifecycle transitions, lifecycle
filtering, immutable reference DTOs, audit correlation, and cross-tenant
read/write denial.

```powershell
python -m pytest -q -p no:cacheprovider modules/compliance.core/tests --ignore=modules/compliance.core/tests/web
```

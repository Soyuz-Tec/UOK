# Location Master Tests

**Status:** Active module-owned tests.

**Current candidate:** `UOK-3.1.0-alpha.3`

The focused suite covers validation and normalization, immutable HTTP DTOs, tenant-scoped code uniqueness, canonical-name history, optimistic versions, idempotent command behavior, role enforcement, lifecycle filtering, audit correlation, and cross-tenant read/write denial.

```powershell
python -m pytest -q -p no:cacheprovider modules/locations.core/tests --ignore=modules/locations.core/tests/web
```

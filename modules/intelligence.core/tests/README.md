# intelligence.core tests

**Status:** Active module-owned test suite.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Purpose:** Prove deterministic read-only derivation, explicit-as-of expiry
boundaries, lifecycle fail-closed behavior, tenant isolation, and frontend
session safety.

**Scope:** Intelligence-owned Python and Vitest coverage; shared architecture
boundary suites remain under the repository `tests/` root.

Python tests cover deterministic readiness derivation, immutable HTTP response
contracts, authorization, module lifecycle, Shipment-source failure behavior,
tenant-scoped list behavior, eligible instance states, null-expiry semantics,
and inclusive 30-calendar-day boundaries. Frontend tests prove that every read
sends the visible UTC as-of date and that no mutation or foreign-module request
is introduced. They live below this same owner test root in `web/`.

```powershell
python -m pytest -q modules/intelligence.core/tests
Push-Location web
npm test -- ../modules/intelligence.core/tests/web
Pop-Location
```

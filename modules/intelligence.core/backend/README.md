# intelligence.core backend

**Status:** Active module-owned backend.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Purpose:** Provide the stateless HTTP adapter and deterministic readiness
derivation behind the supported Intelligence facade.

**Scope:** The private implementation lives below
`uok_intelligence_core._internal`. External Python callers may import only
`api_router` and `role_grants` from `uok_intelligence_core.public_api`.

The private Shipment gateway is the sole feature dependency. It imports exactly
`ShipmentReadinessSnapshotDTO` and
`resolve_shipment_readiness_snapshots` from the Shipment public facade and
converts those immutable owner values into local readiness facts.

Every HTTP read requires an explicit `as_of` date. Intelligence applies the
fixed UTC v1 policy, calculates the inclusive 30-calendar-day warning boundary,
and passes both calendar dates to the owner resolver. The owner DTO returns
only tenant-authorized aggregates for current recorded/verified instance
expiry; Intelligence derives fixed reasons and the existing three bands
without persistence or mutation.

Validate with:

```powershell
python -m pytest -q modules/intelligence.core/tests
```

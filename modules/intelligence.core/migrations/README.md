# intelligence.core migrations

**Status:** Intentionally empty for the active stateless slices.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Purpose:** Record why this capability has no persistence migration.

**Scope:** Base Shipment Readiness and bounded document-expiry derivation only.

This migration path is intentionally empty.

Shipment readiness signals, including explicit-as-of expiry aggregates, are
derived on demand from immutable value data returned by the `shipments.core`
public facade. This module owns no ORM mapping, table, foreign key, SQL view,
cache, snapshot, command log scope, or event record scope, so this extension
has no SQL migration.

Validate the zero-owned-table and empty-migration contract with:

```powershell
python -m pytest -q tests/test_module_manifest_contract.py tests/test_module_model_claim_contract.py
```

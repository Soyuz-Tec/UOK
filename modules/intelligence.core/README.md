# intelligence.core

**Status:** Active optional capability module.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Purpose:** Derive explainable Shipment readiness advice without taking
ownership of Shipment facts or workflow.

**Scope:** The bounded Shipment Readiness list/detail surface, its read-only API,
owner-facade dependency, tests, and candidate verifier.

`intelligence.core` owns deterministic, read-only Shipment readiness signals.
It derives current advisory bands and reason codes from immutable value data
supplied by the `shipments.core` public facade.

Shipment remains the sole owner of shipment, requirement, document-instance,
history, lifecycle, and tenant-visibility facts. Intelligence owns no database
mapping, table, migration SQL, command, event, cache, workflow mutation, score,
probability, or model inference.

The first slice classifies tenant-visible Shipments as `attention_required`,
`not_assessed`, or `ready`. It never blocks or changes Shipment workflow.

Validate the module through the repository candidate gate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```

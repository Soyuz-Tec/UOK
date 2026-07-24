# intelligence.core

**Status:** Active optional capability module.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Purpose:** Derive explainable Shipment readiness advice, including bounded
document-expiry attention, without taking ownership of Shipment facts or
workflow.

**Scope:** The bounded Shipment Readiness list/detail surface, its read-only API,
explicit-as-of evaluation policy, owner-facade dependency, tests, and candidate
verifier.

`intelligence.core` owns deterministic, read-only Shipment readiness signals.
It derives current advisory bands and reason codes from immutable value data
supplied by the `shipments.core` public facade.

Shipment remains the sole owner of shipment, requirement, document-instance,
history, lifecycle, and tenant-visibility facts. Intelligence owns no database
mapping, table, migration SQL, command, event, cache, workflow mutation, score,
probability, or model inference.

The base slice classifies tenant-visible Shipments as `attention_required`,
`not_assessed`, or `ready`. The bounded expiry extension requires an explicit
`as_of` date, evaluates current recorded/verified document instances in UTC
against an inclusive 30-calendar-day horizon, and keeps null expiry dates
informational. It never blocks or changes Shipment workflow.

Design and qualification authority:

- `docs/delivery/shipment-readiness-signals-slice-design-2026-07-18.md`
- `docs/delivery/shipment-document-expiry-readiness-slice-design-2026-07-23.md`
- `docs/delivery/shipment-document-expiry-readiness-slice-delivery-2026-07-23.md`

Validate the module through the repository candidate gate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```

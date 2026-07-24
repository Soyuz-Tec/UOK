# shipments.core backend

`uok_shipments_core.public_api` is the only supported cross-module boundary.
ORM mappings, gateways, request schemas, reads, writes, and HTTP adapters remain
private under `_internal`.

Shipment requirement behavior consumes only
`ComplianceDocumentTypeReferenceDTO` and
`resolve_compliance_document_type_references` from
`uok_compliance_core.public_api`. Shipment owns the link/history mappings and
stores no copied Compliance type metadata. Document-instance behavior reuses
that exact immutable DTO resolver, stores only bounded metadata, and exposes no
ORM object or file/binary contract.

The supported facade also exposes frozen `ShipmentReadinessSnapshotDTO` values
through `resolve_shipment_readiness_snapshots` for the real
`intelligence.core` caller. The owner resolver enforces Shipment permission,
operational state, and organization scope, then returns only actor-visible
Shipment identity/navigation and aggregate requirement/document-instance
counts. For bounded expiry evaluation, the caller supplies explicit `as_of`
and inclusive through-dates; the owner counts current recorded/verified
instances, excludes draft/superseded rows, and returns only aggregate expiry
facts plus the earliest current/future eligible expiry date. It exposes no
owner row, child identifier, document metadata,
foreign-owner value, SQL expression, or Intelligence signal. Intelligence
derives its advisory bands separately and cannot mutate Shipment state.

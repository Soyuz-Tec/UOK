# shipments.core backend

`uok_shipments_core.public_api` is the only supported cross-module boundary.
ORM mappings, gateways, request schemas, reads, writes, and HTTP adapters remain
private under `_internal`.

Shipment requirement behavior consumes only
`ComplianceDocumentTypeReferenceDTO` and
`resolve_compliance_document_type_references` from
`uok_compliance_core.public_api`. Shipment owns the link/history mappings and
stores no copied Compliance type metadata.

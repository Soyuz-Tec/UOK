# shipments.core migrations

`001_shipments_core.sql` owns `shipments` and `shipment_status_history`.
`002_shipment_document_requirements.sql` owns
`shipment_document_requirements` and
`shipment_document_requirement_history`. Party, Location, Route, and Compliance
Document Type IDs are bounded strings; there are no cross-owner foreign keys or
joins.

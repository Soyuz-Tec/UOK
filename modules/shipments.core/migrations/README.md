# shipments.core migrations

`001_shipments_core.sql` owns `shipments` and `shipment_status_history`.
`002_shipment_document_requirements.sql` owns
`shipment_document_requirements` and
`shipment_document_requirement_history`.
`003_shipment_document_instances.sql` owns
`shipment_document_instances` and `shipment_document_instance_history`; its
only feature foreign keys target Shipment-owned tables. Party, Location, Route,
and Compliance Document Type IDs are bounded strings; there are no cross-owner
foreign keys or joins, blob/binary fields, or storage-key columns.

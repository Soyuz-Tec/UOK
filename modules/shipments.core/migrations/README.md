# shipments.core migrations

`001_shipments_core.sql` owns only `shipments` and
`shipment_status_history`. Party, Location, and Route IDs are bounded strings;
there are no cross-owner foreign keys or joins.

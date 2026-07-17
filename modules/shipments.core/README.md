# shipments.core

Optional tenant-scoped Shipment Support owner for an auditable operational
shipment header and lifecycle. It stores stable Party, Location, and Route IDs
and resolves them only through their owner public APIs.

The first slice intentionally excludes cargo lines, Product references,
booking, rates, tracking, compliance documents, inventory, and Planning
behavior.

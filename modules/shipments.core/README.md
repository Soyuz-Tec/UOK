# shipments.core

Optional tenant-scoped Shipment Support owner for an auditable operational
shipment header, lifecycle, and Shipment-specific Document Type requirement
metadata/history plus non-binary compliance document-instance metadata/history.
It stores stable Party, Location, Route, and Compliance Document Type IDs and
resolves them only through their owner public APIs.

The first slice intentionally excludes cargo lines, Product references,
booking, rates, tracking, document files/binaries/object-store keys,
workflow-blocking compliance rules, inventory, and Planning behavior.

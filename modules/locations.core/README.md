# locations.core

**Status:** Active optional capability module.

**Current candidate:** `UOK-3.1.0-alpha.3`

`locations.core` owns tenant-scoped canonical operational Location Definitions for ports, warehouses, cities, and regions. It keeps stable immutable codes separate from Party addresses, Planning resources, and future Route/Corridor records, preserves canonical-name history, and provides recoverable archive/restore behavior.

The private Python implementation and ORM mappings live under `backend/uok_locations_core/_internal`; only the four runtime-composition hooks in `public_api.py` are supported externally. Migrations, tests, candidate verification, and the Location Master workbench remain owned by this module.

The module does not own Parties, Products, routes, shipments, inventory, warehouse capacity, global Country records, maps, coordinates, or geocoding.

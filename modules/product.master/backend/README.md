# Product Master Backend

**Status:** Active module-owned backend.

**Current candidate:** `UOK-3.1.0-alpha.3`

`uok_product_master.public_api` exposes exactly the API router, command handler provider, command permission provider, and role-grant provider used by Host composition. Product behavior, Pydantic contracts, HTTP delivery, SQLAlchemy mappings, lifecycle rules, tenant predicates, and name-history evidence remain private below `_internal`.

The HTTP adapter imports only the approved Host request seams `get_db` and `current_actor`. No Product Master production code imports another feature module or accesses another feature table.

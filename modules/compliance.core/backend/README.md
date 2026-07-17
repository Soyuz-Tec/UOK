# Compliance Document Type Backend

**Status:** Active module-owned backend.

**Current candidate:** `UOK-3.1.0-alpha.3`

`uok_compliance_core.public_api` exposes one frozen reference DTO and resolver
plus the four runtime-composition hooks used by Host composition. Compliance
behavior, Pydantic contracts, HTTP delivery, SQLAlchemy mappings, lifecycle
rules, tenant predicates, and name-history evidence remain private below
`_internal`.

The HTTP adapter imports only the approved Host request seams `get_db` and
`current_actor`. No Compliance production code imports another feature module,
stores another feature's identifier, or accesses another feature table.

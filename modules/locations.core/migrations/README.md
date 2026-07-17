# Location Master Migrations

**Status:** Active module-owned schema history.

**Current candidate:** `UOK-3.1.0-alpha.3`

`001_locations_core.sql` creates the tenant-owned Location Definition and append-only canonical-name history tables. It contains no foreign feature-table reference; organization and actor references use established Kernel identity mappings.

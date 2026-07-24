# product.master

**Status:** Active optional capability module.

**Current candidate:** `UOK-3.1.0-alpha.3`

`product.master` owns tenant-scoped canonical Product and Material definitions. It keeps stable product codes separate from cargo lots and transactions, preserves immutable canonical-name history, and provides reasoned archive/restore lifecycle behavior.

The private Python implementation and ORM mappings live under `backend/uok_product_master/_internal`; only the four runtime-composition hooks in `public_api.py` are supported externally. Migrations, tests, candidate verification, and the Product Master workbench remain owned by this module.

The module does not own cargo, pricing, inventory, shipments, Parties, routes, compliance documents, or hard-coded commodity seed data.

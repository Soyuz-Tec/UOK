# compliance.core

**Status:** Active optional capability module.

**Current candidate:** `UOK-3.1.0-alpha.3`

`compliance.core` owns the tenant-scoped Compliance Document Type registry. It
keeps stable type codes separate from document instances, preserves immutable
canonical-name history, and provides reasoned active, inactive, and archived
lifecycle behavior.

The private Python implementation and ORM mappings live below
`backend/uok_compliance_core/_internal`. External callers may use only the six
supported symbols in `public_api.py`; its reference DTO and resolver results are
immutable/value-only, while the remaining symbols are composition providers.
Migrations, tests, candidate verification, and the Compliance Document Types
workspace remain owned by this module.

The module does not own files, document instances, Shipment requirements,
customs rules, Parties, Products, Locations, Routes, Planning work, or
hard-coded legal truth.

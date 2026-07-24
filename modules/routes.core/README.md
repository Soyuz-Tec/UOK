# routes.core

**Status:** Active optional capability module.

**Current candidate:** `UOK-3.1.0-alpha.3`

`routes.core` owns tenant-scoped Route/Corridor Definitions: immutable codes,
optional transport-mode hints, ordered paths of two to ten stable Location IDs,
recoverable lifecycle, optimistic versions, and canonical-name history.

Location identity remains owned by `locations.core`. Route consumes only the
immutable `LocationReferenceResolution` facade and never imports Location ORM
mappings, queries Location tables, creates cross-feature foreign keys, or
copies Location master facts into Route tables.

Shipment execution, Planning, Party/Product associations, schedules, rates,
distance, optimization, tracking, geocoding, and GIS are outside this owner.

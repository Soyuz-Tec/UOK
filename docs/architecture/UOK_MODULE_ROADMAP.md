# UOK Module Roadmap

**Status:** UOK-level module index

**Current candidate:** `UOK-3.1.0-alpha.3`

## Module Documentation Rule

Detailed module plans live with the module under:

```text
docs/modules/<module-name>/
```

This keeps modules portable, independently maintainable, and easier to version separately in future builds.

Architecture documents only track UOK-level governance, release targets, and module status.

## Active Modules

| Module | Type | Manifest maturity | Status | Current target | Plan |
|---|---|---|---|---|---|
| `apps.manager` | control module | `runtime_proven` | required manifest-mounted control module | `UOK-3.1.0-alpha.3` | UOK bootstrap control module |
| `agents.core` | capability module | `planned` | inert scaffold for governed agent operations | `UOK-3.1.0-alpha.3` | `docs/modules/agents.core/AGENTS_CORE_MODULE_PLAN.md` |
| `calendar.core` | capability module | `runtime_proven` | global calendar API and workspace capability | `UOK-3.1.0-alpha.3` | `docs/modules/calendar.core/CALENDAR_CORE_MODULE_PLAN.md` |
| `communications.core` | capability module | `runtime_proven` | K Connect thread provider and Planning deep-link adapter | `UOK-3.1.0-alpha.3` | `docs/modules/communications.core/COMMUNICATIONS_CORE_MODULE_PLAN.md` |
| `compliance.core` | capability module | `runtime_proven` | tenant-scoped Compliance Document Type registry with lifecycle and name history | `UOK-3.1.0-alpha.3` | `docs/modules/compliance.core/COMPLIANCE_DOCUMENT_TYPE_MODULE_PLAN.md` |
| `contacts.core` | capability module | `runtime_proven` | Contacts capability with module-owned candidate evidence | `UOK-3.1.0-alpha.3` | `docs/modules/contacts.core/CONTACTS_APP_PLAN.md` |
| `intelligence.core` | capability module | `runtime_proven` | stateless, read-only tenant-scoped Shipment readiness and explicit-as-of document-expiry signals over immutable Shipment owner facts | `UOK-3.1.0-alpha.3` | `docs/modules/intelligence.core/SHIPMENT_READINESS_SIGNALS_MODULE_PLAN.md` |
| `locations.core` | capability module | `runtime_proven` | tenant-scoped Location Definition registry with lifecycle and name history | `UOK-3.1.0-alpha.3` | `docs/modules/locations.core/LOCATION_MASTER_MODULE_PLAN.md` |
| `planning.core` | capability module | `runtime_proven` | Gates A-E locally proven, including portfolio and production-like readiness evidence | `UOK-3.1.0-alpha.3` | `docs/modules/planning.core/PLANNING_CORE_MODULE_PLAN.md` |
| `product.master` | capability module | `runtime_proven` | tenant-scoped Product Definition registry with lifecycle and name history | `UOK-3.1.0-alpha.3` | `docs/modules/product.master/PRODUCT_MASTER_MODULE_PLAN.md` |
| `reports.core` | capability module | `runtime_proven` | secure global report artifact foundation | `UOK-3.1.0-alpha.3` | `docs/reports/SECURE_REPORTS_ARTIFACT_ENGINE.md` |
| `routes.core` | capability module | `runtime_proven` | tenant-scoped ordered Route/Corridor definitions over Location owner DTOs | `UOK-3.1.0-alpha.3` | `docs/modules/routes.core/ROUTE_CORRIDOR_MODULE_PLAN.md` |
| `shipments.core` | business module | `runtime_proven` | tenant-scoped Shipment lifecycle, Document Type requirements, and non-binary document-instance metadata over owner DTOs | `UOK-3.1.0-alpha.3` | `docs/modules/shipments.core/SHIPMENT_SUPPORT_MODULE_PLAN.md` |

## Current Target

`UOK-3.1.0-alpha.3` hardens `contacts.core` as the first independently managed Contacts app:

- party model for people and organizations
- three UI views
- review queue
- private internal notes
- relationships
- persistent user-managed contact groups
- CSV import
- warning-based duplicate handling
- owner/team-ready permission fields
- archive, restore, and admin purge
- manifest-declared API router, command handlers, command permissions, role grants, dashboard provider, evidence provider, model exports, and candidate verifier scenario
- module-owned behavior tests under `modules/contacts.core/tests`
- module-owned operational index and contact group migrations under `modules/contacts.core/migrations`
- module-owned Contacts React/CSS source and tests composed from its validated manifest through the generated frontend catalog

It also introduces the `agents.core` scaffold as the next capability boundary for AI-powered business operations:

- governed agent runbooks
- Codex and future tool bindings under UOK approval and audit control
- human approval gates for high-impact actions
- compliance evidence for agent runs
- future Contacts pilot for enrichment and duplicate-cleanup recommendations

It also introduces `planning.core` as the integrated planning and Gantt capability:

- project list and project schedule read model
- task grid and Gantt timeline workspace
- milestone-ready task model
- finish-to-start dependencies
- drag-style reschedule API path through Python validation
- planning audit events and candidate verifier scenario
- Playwright UI proof automation for Gantt rendering, keyboard, appearance, responsive layout, and console cleanliness

`communications.core` provides the first real K Connect boundary:

- organization-scoped communication threads and permissioned reads;
- idempotent creation with correlated audit evidence;
- module lifecycle-safe list, detail, and exact-thread workspace navigation;
- actor-specific Planning typed-link resolution without cross-module foreign keys.

`reports.core` adds a product-neutral global artifact boundary for JSON, JSONL, TXT, Markdown, CSV, and TSV report generation before richer PDF, office document, spreadsheet, image, or conversion adapters are added later.

`product.master` adds the first post-freeze Product/Material MDM slice:

- tenant-scoped canonical Product Definitions with organization-unique codes;
- optional category, grade, specification, and base-unit metadata;
- governed create, update, archive, and restore commands with optimistic versions;
- append-only canonical-name history plus normal UOK audit events;
- actor-authorized list, detail, and history APIs;
- a module-owned Product Master workbench and candidate verifier;
- no Cargo, Party, Planning, Location, Compliance, pricing, or inventory coupling.

`locations.core` adds the next post-freeze Location MDM slice:

- tenant-scoped canonical Location Definitions for ports, warehouses, cities, and regions;
- normalized country-code linkage without a shared Country or GIS catalog;
- governed create, update, archive, and restore commands with optimistic versions;
- append-only canonical-name history plus normal UOK audit events;
- actor-authorized list, detail, and history APIs;
- a module-owned Location Master workbench and candidate verifier;
- no Party-address migration, Product/Planning coupling, Route topology, shipment engine, or intelligence scoring.

`routes.core` adds the next post-freeze Route/Corridor MDM slice:

- tenant-scoped Route Definitions with organization-unique immutable codes;
- ordered paths with one origin, up to eight waypoints, and one destination;
- stable Location IDs resolved only through the immutable `locations.core` public facade;
- optional controlled transport-mode hints without schedules, rates, capacity, or optimization;
- governed create, update, archive, and restore commands with optimistic versions;
- append-only canonical-name history plus normal UOK audit events;
- a module-owned Route/Corridor Master workbench and candidate verifier;
- no Location foreign keys/joins, Planning coupling, shipment execution, tracking, GIS, or intelligence scoring.

`shipments.core` adds the first post-freeze operational workflow slice over the completed master-data owners:

- tenant-scoped Shipment headers with organization-unique immutable codes;
- required shipper/consignee Party IDs and origin/destination Location IDs, plus an optional governed Route;
- stable IDs resolved only through immutable Contacts, Location, and Route public facades;
- optional planned dates with date-order validation;
- governed `draft`, `planned`, `in_transit`, `arrived`, `closed`, and `cancelled` lifecycle with optimistic versions;
- append-only status history plus normal UOK command/event evidence;
- Shipment-owned required/optional Compliance Document Type links with
  `missing`, `received`, `waived`, and `not_applicable` metadata;
- append-only requirement history and informational readiness counts that do
  not block the movement lifecycle;
- Shipment-owned document-instance metadata with document number, issuer text,
  issue/expiry dates, lifecycle, notes, optimistic version, and append-only
  history;
- optional owner-local requirement linkage, with an explicit verified-instance
  action that may advance a still-missing linked requirement to `received`;
- Compliance type value data resolved only through the exact immutable
  `compliance.core` facade, with no foreign key, table read, or cross-owner
  join;
- a module-owned Shipment Support workbench and candidate verifier;
- no Product/Cargo lines, booking, rates, tracking, binary/file/object-store
  storage, inventory, customs, Planning table access, workflow-blocking
  compliance engine, or intelligence scoring.

`compliance.core` adds the next post-freeze master-data slice:

- tenant-scoped Compliance Document Types with organization-unique immutable codes;
- optional description and descriptive category without hard-coded legal truth;
- governed active, inactive, archived, and restored lifecycle with optimistic versions;
- append-only canonical-name history plus normal UOK command/event evidence;
- actor-authorized list, detail, history, and immutable reference APIs;
- immutable value resolution consumed by `shipments.core` without a reverse
  dependency or Shipment-table access;
- a module-owned Compliance Document Types workbench and candidate verifier;
- no Compliance-owned document instances, binary vault, Shipment rule,
  Party/Shipment read, customs integration, or intelligence scoring.

`intelligence.core` adds the next post-freeze, freeze-preserving capability
slice:

- deterministic `attention_required`, `not_assessed`, and `ready` Shipment
  readiness bands with fixed explanatory reason codes;
- tenant-visible Shipment identity, lifecycle, requirement counts, and
  document-instance counts consumed only through
  `ShipmentReadinessSnapshotDTO` and
  `resolve_shipment_readiness_snapshots` from the immutable Shipment facade;
- one read-only `/api/intelligence/shipment-readiness` endpoint protected by
  `intelligence.read`;
- a module-owned Shipment Readiness workbench with search, band filters,
  list/detail, Refresh, and an owner-authorized Shipment deep link;
- a required explicit as-of date, fixed UTC v1 evaluation policy, and inclusive
  30-calendar-day warning horizon for current recorded/verified document
  instances;
- expired and expiring-soon attention reasons plus informational
  missing-expiry context, with draft/superseded instances excluded and
  rejected instances retaining the base attention rule;
- a module-owned candidate verifier and backend/frontend boundary tests;
- no table, ORM mapping, SQL migration, cache, command, event, score,
  prediction, or workflow mutation; and
- no Compliance, Contacts, Location, Route, Product, Planning, Reports,
  Calendar, Communications, or Agents dependency.

## Governance Rule

New modules must not add product-specific behavior to the UOK core. They must expose their contracts through module manifests, typed APIs, command handlers, command permissions, role grants, owned table declarations, migrations, tests, dashboard/evidence providers where applicable, and candidate verification.

## Next Boundary Work

- Keep the neutral module-surface host contract small and reject new
  shell/module backedges as modules are added.
- Keep future module React/CSS source and frontend tests in canonical module roots from the first increment.
- Keep future schema changes in module-owned migrations instead of expanding the shared initial baseline.
- Qualify bounded document-expiry readiness under its approved explicit-as-of,
  fixed-UTC v1 policy and inclusive 30-calendar-day horizon, then select the
  next product increment from operator evidence.
- Defer configurable organization/tenant time zones until UOK has an owned
  setting, authorization and compatibility rules, a separate decision, and a
  migration as applicable.
- Keep scores, predictions, persisted Intelligence state, workflow mutation,
  file vaults, full cargo/commercial transactions, carrier integrations,
  tracking, inventory, workflow blocking, and customs outside this bounded
  Intelligence capability.

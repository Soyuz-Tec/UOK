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
| `contacts.core` | capability module | `runtime_proven` | Contacts capability with module-owned candidate evidence | `UOK-3.1.0-alpha.3` | `docs/modules/contacts.core/CONTACTS_APP_PLAN.md` |
| `locations.core` | capability module | `runtime_proven` | tenant-scoped Location Definition registry with lifecycle and name history | `UOK-3.1.0-alpha.3` | `docs/modules/locations.core/LOCATION_MASTER_MODULE_PLAN.md` |
| `planning.core` | capability module | `runtime_proven` | Gates A-E locally proven, including portfolio and production-like readiness evidence | `UOK-3.1.0-alpha.3` | `docs/modules/planning.core/PLANNING_CORE_MODULE_PLAN.md` |
| `product.master` | capability module | `runtime_proven` | tenant-scoped Product Definition registry with lifecycle and name history | `UOK-3.1.0-alpha.3` | `docs/modules/product.master/PRODUCT_MASTER_MODULE_PLAN.md` |
| `reports.core` | capability module | `runtime_proven` | secure global report artifact foundation | `UOK-3.1.0-alpha.3` | `docs/reports/SECURE_REPORTS_ARTIFACT_ENGINE.md` |
| `routes.core` | capability module | `runtime_proven` | tenant-scoped ordered Route/Corridor definitions over Location owner DTOs | `UOK-3.1.0-alpha.3` | `docs/modules/routes.core/ROUTE_CORRIDOR_MODULE_PLAN.md` |
| `shipments.core` | business module | `runtime_proven` | tenant-scoped operational Shipment headers and auditable movement lifecycle over owner DTOs | `UOK-3.1.0-alpha.3` | `docs/modules/shipments.core/SHIPMENT_SUPPORT_MODULE_PLAN.md` |

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
- a module-owned Shipment Support workbench and candidate verifier;
- no Product/Cargo lines, booking, rates, tracking, documents, inventory, customs, Planning table access, or intelligence scoring.

## Governance Rule

New modules must not add product-specific behavior to the UOK core. They must expose their contracts through module manifests, typed APIs, command handlers, command permissions, role grants, owned table declarations, migrations, tests, dashboard/evidence providers where applicable, and candidate verification.

## Next Boundary Work

- Keep the neutral module-surface host contract small and reject new
  shell/module backedges as modules are added.
- Keep future module React/CSS source and frontend tests in canonical module roots from the first increment.
- Keep future schema changes in module-owned migrations instead of expanding the shared initial baseline.
- Select the next Compliance Document Type, thin Intelligence Signal, or Shipment Document slice from real workflow evidence; keep full cargo/commercial transactions, carrier integrations, tracking, inventory, and customs outside Shipment Support.

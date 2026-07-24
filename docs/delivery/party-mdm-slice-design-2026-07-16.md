# Party/MDM Product Master Slice Design – 2026-07-16

**Status:** Approved implementation design.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Purpose:** Define the first product-delivery slice on the frozen modular monolith before implementation begins.

**Scope:** One tenant-scoped Product/Material master-data capability. Party remains owned by `contacts.core`; this slice does not change Party behavior or any existing module facade.

## 1. As-Is Party/MDM Foundation

`contacts.core` is the current golden Party and Contacts system of record:

- `modules/contacts.core/backend/uok_contacts_core/_internal/persistence/models.py` owns the canonical `Party` mapping and core Party records.
- `modules/contacts.core/backend/uok_contacts_core/_internal/persistence/system_models.py` owns first-class facts, consent evidence, teams, duplicate candidates, saved views, external identities, and custom fields.
- `modules/contacts.core/migrations/003_contacts_core_system_of_record.sql` and `004_contacts_core_merge_privacy.sql` own the current Party/MDM schema evolution.
- `modules/contacts.core/backend/uok_contacts_core/public_api.py` exposes exactly eight supported symbols: `PartyReferenceResolution`, `api_router`, `command_handlers`, `command_permissions`, `dashboard_counts`, `evidence`, `resolve_party_reference`, and `role_grants`.
- `docs/modules/contacts.core/CONTACTS_APP_PLAN.md` records all seven Contacts system slices as implemented, including first-class facts, tenant/visibility controls, import/export, dedupe/rollback, saved views, provider-neutral identities, and custom fields.
- `modules/contacts.core/backend/uok_contacts_core/_internal/registry/read_model_profile.py` and `modules/contacts.core/web/src/ContactBusinessIntelligenceProfile.tsx` already provide the derived, read-only Contacts intelligence profile foundation.

No active module, ORM mapping, migration, manifest, API, or UI owns Product/Material definitions. Repository search finds Product and Material only as policy/future references or Planning-local typed resource labels; those Planning rows are schedule resources, not master data. The mandatory `docs/architecture/UOK_PRODUCT_CARGO_SEPARATION_POLICY.md` explicitly defines `ProductDefinition` as master data and reserves `product.master` as its owner.

## 2. Missing Day-to-Day Trading Capability

RCN export-import operations need a tenant-owned canonical product identity before cargo lots, quotes, contracts, shipments, documents, or intelligence can reference a stable commodity/material definition. Today an operator can govern Parties but cannot create or retrieve a canonical product code, name, category, grade/specification, or unit convention.

Using Planning's free-text `material` resource rows would create a second source of truth, while putting product definitions in Contacts would mix Party and Product ownership. A Product Master registry is therefore the smallest high-value MDM gap supported by current code and policy evidence.

## 3. Chosen Slice

Implement one coherent capability: a tenant-scoped **Product Definition registry** in a new `product.master` capability module.

The slice includes:

- create a Product Definition with an organization-unique normalized code;
- list and open actor-visible Product Definitions, including an explicit archived filter;
- update canonical name and optional category, grade, specification, and base-unit code using an expected version;
- archive and restore a Product Definition without deleting history;
- append immutable name-history evidence when the canonical name changes;
- emit normal UOK command/event audit evidence for every write;
- expose a small Product Master workbench for search, create, edit, archive, restore, and history review.

This is preferred over Location/Route because the repository already mandates `product.master` as the initial Product/Cargo boundary and Planning already anticipates material references without providing an authoritative Product owner. It is preferred over Compliance Document Type because no current compliance aggregate or workflow establishes that type's consumers. Contacts intelligence is not selected because its Party-derived foundation is already implemented.

## 4. Ownership And Minimal Public API

| Concern | Owner | Planned surface |
|---|---|---|
| Product behavior, validation, reads, writes, lifecycle, and audit | `modules/product.master` | Private `_internal` implementation |
| Runtime composition facade | `modules/product.master/backend/uok_product_master/public_api.py` | Exactly `api_router`, `command_handlers`, `command_permissions`, and `role_grants` |
| Product HTTP read contract | `product.master` | `/api/products/definitions` and `/api/products/definitions/{id}/name-history` |
| Product commands | `product.master` | `CreateProductDefinition`, `UpdateProductDefinition`, `ArchiveProductDefinition`, `RestoreProductDefinition` |
| Product UI | `modules/product.master/web/src` | Canonical `moduleSurface.tsx`, section `products` |
| Composition, auth, DB session, generic command bus | Host | Existing mechanisms only |

No existing facade is widened. No cross-module Python caller is introduced, so this slice intentionally does not publish a speculative Product query DTO. HTTP responses are serialization-safe Pydantic value data and never expose SQLAlchemy mappings. A future Cargo, Planning, or Intelligence consumer must justify and add an immutable owner DTO/query contract through the freeze exception process.

The new module itself is permitted by Architecture Freeze rule 4 and by the existing Product/Cargo separation policy; it is not a module split or an architecture unfreeze.

## 5. Data Ownership

`product.master` will exclusively own:

| Table / mapping | Purpose |
|---|---|
| `product_definitions` / `ProductDefinition` | Tenant-scoped canonical product/material identity and lifecycle |
| `product_name_history` / `ProductNameHistory` | Append-only canonical-name changes with actor, reason, and timestamp |

`ProductDefinition` stores organization ID, immutable normalized code, canonical name, optional category/grade/specification/base-unit code, lifecycle status, optimistic version, creator/updater IDs, timestamps, and archive timestamp. The uniqueness constraint is `(organization_id, code)`.

`ProductNameHistory` stores organization ID, the owning Product Definition ID, previous/new names, reason, actor ID, and changed timestamp. Its only feature foreign key is to `product_definitions`, inside the same owner. Organization and user references use the established universal Kernel mappings. The module declares scoped `CommandLog:product.master` and `EventRecord:ProductDefinition` use; it does not own or query those Kernel tables directly beyond established event/command helpers.

There are no Contacts, Planning, Cargo, Location, Compliance, or other feature foreign keys, joins, table reads, or writes.

## 6. Tenant Isolation

- Every read predicate includes `ProductDefinition.organization_id == actor.organization_id`.
- Product history reads require both the actor organization and an organization-scoped Product Definition lookup.
- Every command derives organization ownership from the authenticated immutable `Actor`; payloads cannot choose an organization.
- Update, archive, and restore locate rows by both `id` and `organization_id`, then enforce the supplied expected version.
- Product code uniqueness is database-enforced per organization, so two tenants may use the same code safely.
- API routes require `products.read`; commands require `products.manage`; module operational state is checked before reads.
- UI capability visibility is convenience only. Backend permissions and tenant predicates remain authoritative.
- Tests create two organizations with the same product code and prove that neither actor can read or mutate the other tenant's row or history.

## 7. Explicit Non-Goals

- Changing Party, Contacts, Party dedupe, Contacts intelligence profiles, or Contacts' eight-symbol facade.
- Linking Products to Parties, suppliers, buyers, Planning resources, contracts, shipments, Cargo, routes, locations, or compliance records.
- Creating `cargo.transactions`, Location/Route, Compliance Document Type, or Intelligence Signals.
- Cross-module joins, foreign feature keys, shared Product tables, or Product behavior in Host/Kernel.
- HS-code taxonomy, commodity-grade dictionaries, unit conversion, aliases, merge/dedupe, bulk import/export, pricing, inventory, lot tracking, or hard-coded RCN seed data.
- Changing shell contracts, adding a runtime plugin loader, creating a microservice, or splitting an existing module.

## 8. Test Plan

### Domain and unit

- Validate code normalization, nonblank canonical names, optional field trimming, unit-code format, and forbidden extra payload fields.
- Prove create/update/archive/restore behavior, optimistic version checks, idempotent command behavior, and name-history append semantics.
- Prove an unchanged name does not create false history.

### Boundary and contract

- Add `product.master` to exact public-facade enforcement with four supported symbols; reject all imports of its private implementation from outside the owner.
- Add the exact Product API adapter imports of `get_db` and `current_actor` to the Host allowlist; permit no other Host symbol.
- Keep `tests/test_planning_data_boundary.py`, Planning/Contacts facade enforcement, Kernel/Host, shell/module SCC, model ownership, manifest, API-prefix, and generated-catalog tests green.
- Regenerate the model metadata and frontend catalog fixtures through their existing generators.

### Integration and tenant proof

- Install `product.master`, create and update a Product Definition through the command bus, read it through `/api/products`, inspect name history, archive/restore it, and verify audit correlation.
- Create two organizations using the same product code; prove same-tenant reads work and cross-tenant detail, history, update, archive, and restore attempts fail closed.
- Add a Vitest workbench proof for install state, tenant-authorized load, search, create, edit, archive/restore, and history display.
- Add a module-owned candidate verifier and run it against the rebuilt local PostgreSQL candidate before claiming `runtime_proven`.

## 9. Architecture Freeze Compliance Checklist

- [x] Business code is designed only under `modules/product.master`.
- [x] Host changes are limited to manifest-driven composition and the exact tested request-adapter allowlist; no Host business logic is planned.
- [x] Kernel receives no new contract, mapping, helper, or permission rule.
- [x] Party remains the `contacts.core` golden identity; Contacts code, tables, and facade remain unchanged.
- [x] No foreign ORM/table access, cross-module join, foreign feature key, or shared Product table is planned.
- [x] The new module has one clear capability, canonical physical ownership, a closed manifest, private mappings, module-owned migrations/tests/verifier/UI, and a four-symbol composition facade.
- [x] The shell will import the Product surface only through the generated catalog and neutral `ModuleSurfaceHostContext`.
- [x] No existing public facade or neutral shell port is widened.
- [x] No existing module is split and no accepted SCC is changed.
- [x] Gap 1–3 gates, full module contracts, frontend contracts, candidate verification, and CI remain release requirements.

## Validation

Implementation acceptance requires the commands documented in `docs/architecture/ARCHITECTURE-FREEZE-2026-07-16.md`, the new `product.master` backend/frontend suites, generated-contract checks, a local candidate rebuild and Product verifier, and green hosted CI.

# UOK Product And Cargo Separation Policy

**Status:** Mandatory UOK domain policy

UOK must not treat product and cargo as the same concept.

**Current implementation:** `product.master` owns the tenant-scoped
`ProductDefinition` registry, `shipments.core` owns the operational Shipment
header, movement-status lifecycle, and Shipment-specific Document Type
requirement plus non-binary document-instance metadata/history, and
`compliance.core` owns only Compliance Document Type vocabulary.
`cargo.transactions` and `crm.basic` remain future modules.

## Definitions

- **Product** is a master-data definition: canonical name, code, category, grade/specification, unit conventions, and product governance.
- **Cargo** is a transactional/physical lot or movement of a product: nomination, seller, buyer, quantity, loading state, documents, payment state, exceptions, and closeout evidence.
- **Cargo transaction** references a Product. It does not become the Product.
- **Shipment** is the operational movement header: shipper, consignee, origin,
  destination, optional governed corridor, planned dates, auditable movement
  status, Shipment-specific document-requirement applicability/satisfaction,
  and operational compliance document-instance metadata. It does not become a
  Product, Cargo transaction, Compliance vocabulary owner, commercial-document
  content owner, or file vault.
- **Compliance Document Type** is tenant-governed master vocabulary for a kind
  of evidence. It is not a document-instance row, file, Shipment requirement,
  Cargo transaction, or legal determination.
- **Product modules** define reusable product master metadata and product-specific rules.
- **Shipment modules** define movement identity, operational status, and
  Shipment-owned requirement and compliance document-instance metadata without
  owning Product facts, commercial cargo lots, Compliance type vocabulary,
  binary assets, commercial document content, payments, rates, tracking, or
  inventory.
- **Cargo modules** define physical/commercial lot lifecycle, Product/quantity facts, commercial documents, payment, and transaction evidence. They may reference a Shipment through a future immutable contract; they do not absorb Shipment movement state.
- **CRM modules** define sales/account/opportunity workflows and may reference Contacts, Products, or Cargo records through explicit relationships; they must not own Product Master or Cargo lifecycle state.

## Rules

- UOK core code must use product-neutral and cargo-neutral abstractions.
- UI labels must not combine product and cargo wording into one label.
- A product record may exist in Product Master.
- A shipment may reference Parties, Locations, and a Route through their immutable owner APIs while storing only stable IDs.
- A Shipment document requirement references a Compliance Document Type through
  its immutable owner API; it must not duplicate type metadata, read Compliance
  tables, store a document file, or block the Shipment movement lifecycle.
- A Shipment document-instance row may record bounded operational metadata and
  link to an owner-local requirement. It resolves type validity through the
  Compliance immutable DTO API and must not store blobs, file paths, object
  store keys, multipart payloads, or copied Compliance master data.
- A cargo transaction may reference a Product Master record.
- CRM opportunities may reference products or intended cargo transactions, but must not duplicate Contacts or Product Master records.
- Products, Cargo Transactions, and CRM must be installable and separately updatable modules with explicit dependencies.

## Future Module Implication

The product/cargo expansion path must model these as separate module-owned concepts:

- `ProductDefinition` for product master.
- `Shipment` for the operational movement header and status history.
- `CargoTransaction` for cargo lots, workflow state, transaction parties, and evidence.
- `CRMOpportunity` or an agreement record that references Contacts and may later reference Product or Cargo records.

## Initial Module Boundaries

- `product.master`: installable capability module; owns product definitions and product metadata.
- `shipments.core`: installable business module; depends on `contacts.core`,
  `locations.core`, `routes.core`, and `compliance.core`; owns the operational
  Shipment header, movement-status history, and Shipment-specific Document Type
  requirement links/history plus non-binary compliance document-instance
  metadata/history.
- `compliance.core`: installable capability module with no feature dependency; owns Compliance Document Type identity, lifecycle, and canonical-name history only.
- `cargo.transactions`: installable business module; depends on `product.master` and `contacts.core`; owns cargo lifecycle.
- `crm.basic`: installable business module; depends on `contacts.core`; owns CRM opportunity workflow.

## Current Product Master Slice

The first implemented slice is intentionally limited to canonical Product Definition identity, organization-scoped code uniqueness, optional category/grade/specification/base-unit metadata, governed lifecycle, optimistic versions, and append-only canonical-name history. It does not own Cargo, Party relationships, pricing, inventory, logistics, routes, compliance documents, or transaction evidence.

Implementation and validation:

- `docs/modules/product.master/PRODUCT_MASTER_MODULE_PLAN.md`
- `docs/delivery/party-mdm-slice-design-2026-07-16.md`
- `docs/delivery/party-mdm-slice-delivery-2026-07-16.md`
- `modules/product.master`

## Current Shipment Support Slice

The first Shipment slice is intentionally limited to tenant-scoped Shipment
identity, required shipper/consignee and origin/destination references, an
optional governed Route, planned dates, optimistic updates, a controlled
movement-status machine, and append-only status history. The approved
requirement-metadata increment adds only required/optional links, simple
satisfaction state, notes, an informational summary, and append-only history
owned by Shipment. The document-instance increment adds only bounded metadata,
an audited `draft` through `superseded` lifecycle, and an optional owner-local
requirement link. It stores only stable foreign IDs and resolves them through
immutable owner DTO APIs.

It does not own Product/material lines, cargo lots, quantity/grade, pricing,
inventory, bookings, carriers, rates, tracking, binary document assets,
commercial document content, a file vault, compliance packs, workflow-blocking
rules, customs filings, invoices, payments, or closeout evidence. Shipment owns
only the narrow operational compliance instance metadata described above.
Those omissions preserve the future
`cargo.transactions`, compliance, inventory, and integration boundaries.

Implementation and validation:

- `docs/modules/shipments.core/SHIPMENT_SUPPORT_MODULE_PLAN.md`
- `docs/delivery/shipment-support-slice-design-2026-07-17.md`
- `docs/delivery/shipment-support-slice-delivery-2026-07-17.md`
- `docs/delivery/shipment-document-requirements-slice-design-2026-07-17.md`
- `docs/delivery/shipment-document-requirements-slice-delivery-2026-07-17.md`
- `docs/delivery/shipment-document-instance-metadata-slice-design-2026-07-17.md`
- `docs/delivery/shipment-document-instance-metadata-slice-delivery-2026-07-17.md`
- `modules/shipments.core`

## Current Compliance Document Type Slice

The first Compliance slice is intentionally limited to tenant-scoped Document
Type identity, descriptive metadata, active/inactive/archive lifecycle,
optimistic versions, append-only canonical-name history, and an immutable
reference facade. Shipment may consume that facade for its own requirement and
document-instance metadata, but Compliance owns no document-instance row or
binary, Shipment
requirement, customs rule, legal decision, Product/Cargo fact, or cross-module
read.

Implementation and validation:

- `docs/modules/compliance.core/COMPLIANCE_DOCUMENT_TYPE_MODULE_PLAN.md`
- `docs/delivery/compliance-document-type-slice-design-2026-07-17.md`
- `docs/delivery/compliance-document-type-slice-delivery-2026-07-17.md`
- `modules/compliance.core`

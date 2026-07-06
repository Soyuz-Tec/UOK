# UOK Product And Cargo Separation Policy

**Status:** Mandatory UOK domain policy

UOK must not treat product and cargo as the same concept.

## Definitions

- **Product** is a master-data definition: canonical name, code, category, grade/specification, unit conventions, and product governance.
- **Cargo** is a transactional/physical lot or movement of a product: nomination, seller, buyer, quantity, loading state, documents, payment state, exceptions, and closeout evidence.
- **Cargo transaction** references a Product. It does not become the Product.
- **Product modules** define reusable product master metadata and product-specific rules.
- **Cargo modules** define cargo lifecycle, logistics, commercial documents, payment, and transaction evidence.
- **CRM modules** define sales/account/opportunity workflows and may reference Contacts, Products, or Cargo records through explicit relationships; they must not own Product Master or Cargo lifecycle state.

## Rules

- UOK core code must use product-neutral and cargo-neutral abstractions.
- UI labels must not combine product and cargo wording into one label.
- A product record may exist in Product Master.
- A cargo transaction may reference a Product Master record.
- CRM opportunities may reference products or intended cargo transactions, but must not duplicate Contacts or Product Master records.
- Products, Cargo Transactions, and CRM must be installable and separately updatable modules with explicit dependencies.

## Baseline Implication

The UOK baseline must model:

- `ProductDefinition` for product master.
- `CargoTransaction` for cargo lots, workflow state, transaction parties, and evidence.
- `CRMOpportunity` or an agreement record that references Contacts and may later reference Product or Cargo records.

## Initial Module Boundaries

- `product.master`: installable capability module; owns product definitions and product metadata.
- `cargo.transactions`: installable business module; depends on `product.master` and `contacts.core`; owns cargo lifecycle.
- `crm.basic`: installable business module; depends on `contacts.core`; owns CRM opportunity workflow.

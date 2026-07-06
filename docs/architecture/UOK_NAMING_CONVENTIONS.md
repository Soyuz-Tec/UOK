# UOK Naming Conventions

**Convention version:** `2026-07-05.v1`

**Current target:** `UOK-3.1.0-alpha.2`

Naming is an architecture boundary in UOK. UOK names must stay generic, while product-specific terms belong inside product modules and product metadata.

## Mandatory Name Forms

Only these UOK name forms are valid in user-facing places and internal source:

- `UOK`
- `Unified Operating Kernel`

Use the lowercase form `uok` only where files, Python packages, databases, volumes, package names, local storage keys, or container identifiers cannot practically use uppercase or spaces. Retired or expanded variants are not allowed in active source, generated UI output, docs, scripts, package names, runtime names, or test names.

## Required Separation

| Name type | Purpose | Example |
|---|---|---|
| Internal ID | Database identity | UUID |
| Module name | Stable technical module identifier | `commodity.reference_product` |
| Source package | Physical package path | `modules/reference.product/backend/reference_product` |
| Product code | Stable business/product code | `PRODUCT-CODE` |
| Canonical name | Formal product name | `Reference product` |
| Display label | Human-facing UI label | `Reference Product` |
| Module kind | Architectural classification | `capability_module`, `business_module` |

## Rules

- UOK and `core.*` module names must not include product-specific words.
- Capability modules use functional names such as `contacts.core`.
- Product modules use domain-prefixed dotted names such as `commodity.reference_product`.
- Product codes are uppercase, stable, and hyphenated.
- Future product/business modules must declare stable identity, display labels, category, and dependency metadata through manifest-compatible fields before they are promoted beyond prototype status.
- UI labels are separate from internal IDs and business codes.
- Physical module packages stay under top-level `modules/<module_name>`.

## Verification

Run:

```powershell
python -m pytest -q
powershell -ExecutionPolicy Bypass -File .\scripts\verify_uok_candidate.ps1
```

The test suite and candidate verifier check that active source/runtime naming stays within the accepted UOK forms and that product-specific labels do not leak into the baseline UI.

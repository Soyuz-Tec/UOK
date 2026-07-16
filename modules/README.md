# UOK Modules

**Status:** Active module directory guide.

**Current candidate:** `UOK-3.1.0-alpha.3`

This directory is the physical ownership boundary for installable UOK modules. The closed `manifest.yaml` in each module is the machine-readable source of truth for maturity, lifecycle, dependencies, paths, permissions, owned data, and extension points.

## Package Shape

Each module has this reviewable shape:

```text
modules/<module_name>/
  README.md
  manifest.yaml
  backend/
  web/
  migrations/
  tests/
  verify/       # when candidate_verifier is declared
```

Production React source and CSS for a declared workbench surface live under `modules/<module_name>/web/src`; frontend tests live under `modules/<module_name>/tests/web`. The product-neutral shell, shared controls, design tokens, generated contracts, and catalog composition remain under `web/src` at the repository root.

## Current Catalog

| Module | Role |
|---|---|
| `apps.manager` | Required control module for module discovery and lifecycle operations. |
| `agents.core` | Planned inert boundary for governed agent operations. |
| `calendar.core` | Optional calendar, availability, free-busy, recurrence, and workspace capability. |
| `communications.core` | Optional K Connect thread provider and exact authorized deep-link capability. |
| `contacts.core` | Optional Party, Contacts workflow, grouping, relationship, and quality capability. |
| `planning.core` | Optional project planning, Python-authoritative scheduling, Gantt, analysis, and portfolio capability. |
| `product.master` | Optional tenant-scoped Product/Material definition, lifecycle, and name-history capability. |
| `reports.core` | Optional secure report artifact and typed report-client capability. |

Read the owning module `README.md`, its manifest, and the corresponding plan under `docs/modules` before changing module behavior. Run the module release contract and standard verification workflow before publication.

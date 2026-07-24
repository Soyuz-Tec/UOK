# UOK Global Export Artifacts

**Status:** Active architecture guidance.

**Current candidate:** `UOK-3.1.0-alpha.3`

## Purpose

UOK export formats such as CSV, JSON, SVG/image, HTML documents, PDF, office documents, and future import templates are global application capabilities. Individual modules may own the domain payload, but common artifact naming, serialization helpers, browser download behavior, and future export controls belong in shared UOK code.

## Boundary

- Shared frontend export primitives live under `web/src/shared/exporting`.
- Module-specific exporters may build domain payloads from validated module read models.
- Modules must use shared artifact helpers for filename normalization, CSV quoting, JSON formatting, XML/HTML escaping, reusable HTML document serialization, MIME typing, and browser download.
- New reusable export UI controls should be promoted to `web/src/shared` before being copied into another module.
- Server-generated exports, PDF rendering, document rendering, import validation, and long-running export jobs must be designed as shared service boundaries before module-specific use.

## Current Implementation

| Capability | Shared owner | Module use |
|---|---|---|
| Filename normalization | `web/src/shared/exporting` | Planning schedule CSV, import template, project JSON, timeline SVG, schedule document |
| CSV quoting | `web/src/shared/exporting` | Planning task schedule and import template |
| JSON formatting | `web/src/shared/exporting` | Planning project exchange payload |
| XML text escaping | `web/src/shared/exporting` | Planning timeline SVG image export |
| HTML document serialization | `web/src/shared/exporting` | Planning schedule document export |
| Browser text download | `web/src/shared/exporting` | Planning toolbar export commands |
| Planning payload construction | `modules/planning.core/web/src/planningExportModel.ts` | Schedule CSV, JSON, Timeline SVG, and document payloads from validated read models |
| Server report artifact generation | `reports.core` and `modules/reports.core/web/src/serverReports.ts` | Availability-gated Planning CSV, JSON, and Markdown report commands |

## Validation

Shared export behavior is verified by frontend unit tests:

```powershell
npm --prefix web test -- exportArtifacts planningExportModel
```

User-facing module export controls must also pass the UI proof gate:

```powershell
npm --prefix web run test:ui-proof
```

# Planning Data Boundary Inventory – 2026-07-15

**Status:** Pre-refactor leak inventory.

**Current candidate:** `UOK-3.1.0-alpha.3`

## Purpose

Record every direct read by `planning.core` of another capability module's ORM model, table, repository, or schema before the focused Planning data-boundary refactor. The inventory is based on branch `feature/planning-flow-board` at commit `ba4bbd7e9634c354b44ba7cef6caa56504a780c6`.

## Scope

The scan covers production Python under `modules/planning.core/backend`. It includes direct imports, imports through compatibility facades such as `uok.models`, SQLAlchemy queries, raw SQL/table-name references, schema imports, and repository/infrastructure imports. Planning-owned mappings and product-neutral kernel mappings are outside the foreign-module definition.

| File path | Foreign module | Table / model / repo used | Purpose of the read | Proposed fix (API vs read-model vs event) |
|---|---|---|---|---|
| `modules/planning.core/backend/uok_planning_core/link_resolver.py:11,115-127` | `contacts.core` | `Party` ORM model / `parties` table, imported through `uok.models` | Resolve a same-organization Party, apply actor-specific Contacts visibility, report active/purged lifecycle state, and build the Contacts open path for Planning links, participants, and canonical resource references. | **Public query API:** Contacts queries its private model and returns an immutable Party-reference DTO containing only resolver status, display label, status summary, and open path. |
| `modules/planning.core/backend/uok_planning_core/link_resolver.py:11,130-136` | `reports.core` | `ReportArtifact` ORM model / `report_artifacts` table, imported through `uok.models` | Resolve a same-organization report/evidence artifact, report deleted lifecycle state, and build the artifact API path. | **Public query API:** Reports returns an immutable artifact-reference DTO; no artifact ORM object leaves Reports. |
| `modules/planning.core/backend/uok_planning_core/link_resolver.py:11,139-145` | `calendar.core` | `CalendarEvent` ORM model / `calendar_events` table, imported through `uok.models` | Resolve a same-organization event, report canceled lifecycle state, and build the Calendar open path. | **Public query API:** Calendar returns an immutable event-reference DTO and retains all event-model access inside Calendar. |
| `modules/planning.core/backend/uok_planning_core/link_resolver.py:11,148-157` | `communications.core` | `CommunicationThread` ORM model / `communication_threads` table, imported through `uok.models` | Resolve a same-organization K Connect thread, report archived lifecycle state, and build the exact Communications open path. | **Public query API:** Communications returns an immutable thread-reference DTO; no thread ORM object leaves Communications. |

## Completeness Notes

- No additional foreign capability ORM model, repository, schema, raw SQL table read, cross-module join, or cross-module write was found under the Planning production backend.
- `modules/planning.core/backend/uok_planning_core/calendar_bridge.py:43-50` already calls Calendar through its facade and consumes dictionary read models; it is a public-API call, not a table leak. The refactor will route it through the new narrow Calendar public API for one enforceable import convention.
- `CommandLog`, `EventRecord`, and `ModuleRecord` reads in Planning are product-neutral kernel/control-plane mappings declared under `src/uok/kernel_models.py`; they are not another capability module's private data and are outside this focused gap.
- Planning's frontend use of owner HTTP clients is outside this backend ORM/data-boundary refactor. No UI behavior is changed.

## Validation Guidance

Re-run the inventory scan with:

```powershell
rg -n "uok\.models|uok_[a-z0-9_]+_core|select\(|join\(|text\(" modules/planning.core/backend/uok_planning_core
```

The post-refactor architecture test and verification record are documented in `docs/architecture/planning-data-boundary-fix-2026-07-15.md`.

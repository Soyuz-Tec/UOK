# Planning Data Boundary Fix – 2026-07-15

**Status:** Implemented and locally verified.

**Current candidate:** `UOK-3.1.0-alpha.3`

## Purpose

Record the focused, behavior-preserving refactor that removed every `planning.core` read of another capability module's ORM model or table. The pre-refactor evidence is in `docs/architecture/planning-data-boundary-inventory-2026-07-15.md`.

## 1. Before / After Planning Dependencies

| Dependency view | Before | After |
|---|---|---|
| Declared manifest dependency | `calendar.core` | `calendar.core` (unchanged) |
| Contacts reference resolution | `Party` imported through global `uok.models`, direct SQLAlchemy read, then `uok_contacts_core.facade.can_read_party` | `uok_contacts_core.public_api.resolve_party_reference` returning `PartyReferenceResolution` |
| Reports reference resolution | `ReportArtifact` imported through global `uok.models` and read directly | `uok_reports_core.public_api.resolve_report_artifact_reference` returning `ReportArtifactReferenceResolution` |
| Calendar-event reference resolution | `CalendarEvent` imported through global `uok.models` and read directly | `uok_calendar_core.public_api.resolve_calendar_event_reference` returning `CalendarEventReferenceResolution` |
| Calendar availability | `uok_calendar_core.facade` dictionary read models | `uok_calendar_core.public_api` dictionary read models; behavior unchanged |
| Communications reference resolution | `CommunicationThread` imported through global `uok.models` and read directly | `uok_communications_core.public_api.resolve_communication_thread_reference` returning `CommunicationThreadReferenceResolution` |
| Kernel/control-plane mappings | `CommandLog`, `EventRecord`, and `ModuleRecord` imported through global `uok.models` | Imported directly from `uok.kernel_models`; no global registry backdoor remains in Planning production code |

Contacts, Communications, and Reports remain optional providers. Their APIs are imported lazily only after Planning's existing module-operational and permission checks, so disabled-provider behavior remains unchanged and no new required manifest dependency was introduced.

## 2. Former Leaks And Replacement APIs

| Former Planning leak | Owning-module replacement | Planning call site after refactor |
|---|---|---|
| `Party` / `parties` read now located at `modules/planning.core/backend/uok_planning_core/_internal/coordination/link_resolver.py` | `modules/contacts.core/backend/uok_contacts_core/public_api.py` owns the query and returns an immutable value DTO | `_resolve_party` imports only `uok_contacts_core.public_api` |
| `ReportArtifact` / `report_artifacts` read now located at `modules/planning.core/backend/uok_planning_core/_internal/coordination/link_resolver.py` | `modules/reports.core/backend/uok_reports_core/public_api.py` owns the query and returns an immutable value DTO | `_resolve_artifact` imports only `uok_reports_core.public_api` |
| `CalendarEvent` / `calendar_events` read now located at `modules/planning.core/backend/uok_planning_core/_internal/coordination/link_resolver.py` | `modules/calendar.core/backend/uok_calendar_core/public_api.py` owns the query and returns an immutable value DTO | `_resolve_calendar_event` imports only `uok_calendar_core.public_api` |
| `CommunicationThread` / `communication_threads` read now located at `modules/planning.core/backend/uok_planning_core/_internal/coordination/link_resolver.py` | `modules/communications.core/backend/uok_communications_core/public_api.py` owns the query and returns an immutable value DTO | `_resolve_communication_thread` imports only `uok_communications_core.public_api` |
| Broad Calendar facade import now located at `modules/planning.core/backend/uok_planning_core/_internal/coordination/calendar_bridge.py` | The same Calendar-owned occurrence/free-busy DTO queries are re-exported from `uok_calendar_core.public_api` | `calendar_bridge.py` imports only the exact owner public API surface |

Each newly added reference-resolution API accepts the existing SQLAlchemy `Session` and `Actor`, performs a read-only organization-scoped query, enforces the existing provider permission/disclosure logic, and returns only `status`, `display_label`, `status_summary`, and `open_path`. Calendar's pre-existing occurrence/free-busy queries remain dictionary read models re-exported through the same owner public API. No DTO or read model contains or returns an ORM object, table, SQLAlchemy expression, or repository implementation.

## 3. Zero Remaining Foreign ORM Reads

Confirmed. Production Python under `modules/planning.core/backend/uok_planning_core` now has:

- zero `uok.models` imports;
- zero imports from another module's models, schemas, services, repositories, read-model internals, or broad facade;
- zero direct references to `Party`, `ReportArtifact`, `CalendarEvent`, or `CommunicationThread`;
- zero raw reads or joins against `parties`, `report_artifacts`, `calendar_events`, or `communication_threads`;
- only exact owner imports from `uok_calendar_core.public_api`, `uok_contacts_core.public_api`, `uok_communications_core.public_api`, and `uok_reports_core.public_api`.

`tests/test_planning_data_boundary.py` independently scans every Planning production Python AST, including imports nested inside functions and `try` blocks. It permits only named members from an explicit per-owner `public_api` symbol allowlist, and its scanner self-tests prove that foreign models, schemas, services, facades, compatibility backdoors, broad public-API module aliases, and non-contract public-API symbols fail while an exact owner contract import passes. Owner public APIs keep their ORM imports under private aliases and exclude them from `__all__`.

## 4. Run The Architecture Test

Focused boundary gate:

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
$env:UOK_BOOTSTRAP_ON_IMPORT='0'
python -m pytest -q -p no:cacheprovider tests/test_planning_data_boundary.py
```

Affected module regression suite:

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
$env:UOK_BOOTSTRAP_ON_IMPORT='0'
python -m pytest -q -p no:cacheprovider tests/test_planning_data_boundary.py modules/calendar.core/tests modules/communications.core/tests modules/contacts.core/tests modules/planning.core/tests modules/reports.core/tests
```

Local verification completed on 2026-07-15:

- focused architecture and former-leak behavior set: passed;
- new Calendar-event public-API link regression: passed;
- affected Calendar, Communications, Contacts, Planning, and Reports backend suites plus the new architecture gate: **252 tests passed**;
- relevant Python compilation: passed;
- repository Python runner: **113 unique test files passed**;
- `TechnologyAudit` and `Audit`: passed, including dependency audits, generated-contract drift, module release contracts, source boundaries, naming, and source-size gates;
- local Podman `Rebuild`: passed; the rebuilt API returned a healthy `/health` response and the live database-capacity check passed;
- standardized `Verify`: passed, including **108 frontend test files / 391 tests**, **19 Playwright proofs passed / 1 intentionally skipped**, the static build, and all six runtime-proven module candidate verifiers.

## 5. Residual Risks

1. The public query APIs are in-process contracts and intentionally accept the monolith's shared SQLAlchemy `Session`. They close data ownership now; a future process extraction would still need transport adapters around the same DTO contracts.
2. The AST gate detects static imports and compatibility facades, not dynamically constructed imports, raw SQL, or reflective access through SQLAlchemy metadata. The exhaustive source scan found no such Planning access; a repository-wide SQL/table-ownership gate remains separate work.
3. Closed manifest `uok.module.v1` has no optional-provider dependency field. Contacts, Communications, and Reports therefore remain explicit lazy public-API integrations rather than declared required dependencies. Changing the manifest schema is outside this focused refactor.
4. To honor the behavior-preserving constraint, owner APIs retain the existing resolver permission, tenant, lifecycle, labels, and open paths. Tightening provider-specific row-visibility rules would be a separate authorized behavior/security change and was not bundled into this refactor.

## Validation Outcome

The focused goal is met: Planning no longer reads any other capability module's ORM model, table, schema, repository, or infrastructure layer. No module split, frontend shell change, UI change, feature addition, database migration, command/event change, or business-behavior change was made.

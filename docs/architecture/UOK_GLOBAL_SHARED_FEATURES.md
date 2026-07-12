# UOK Global Shared Features

**Status:** Active architecture guidance.

**Current candidate:** `UOK-3.1.0-alpha.3`

## Purpose

UOK modules can own domain behavior without copying common workspace and infrastructure patterns. Shared features are module-neutral capabilities that improve consistency, reduce duplicate code, and keep future modules easier to implement.

## Current Shared Boundaries

| Shared capability | Owner | Used by |
|---|---|---|
| Module event emission | `src/uok/module_events.py` | Contacts, Planning, Reports |
| CSV row limits and spreadsheet-safe cells | `src/uok/data_exchange.py` | Contacts import, Reports formats |
| Report artifact generation and download | `reports.core` plus `modules/reports.core/web/src/serverReports.ts` | Availability-gated Planning exports |
| Search, filters, sort, grouping, and saved views | `web/src/shared/forms` | Apps, Calendar, Communications, Contacts, and Planning |
| Workspace command-bar layout and accessible query/context/action grouping | `web/src/shared/layout` | Apps, Calendar, Communications, Contacts, and Planning through optional composition slots |
| Table column visibility, resize, order, pinned columns, and row heights | `web/src/shared/tables` | Contacts and Planning |
| Bounded pagination controls and accessible range announcements | `web/src/shared/tables` | Contacts and Planning portfolio |
| Toggle, command, icon, and segmented controls | `web/src/shared/primitives` | Contacts and Planning |
| Bounded draggable modal workspace overlays and editor composition | `web/src/shared/overlays` | Communications, Contacts, and Planning |
| Empty states, status pills, detail items, and fact lists | `web/src/shared/data-display` | Apps, Contacts, Planning |

## Promotion Rule

A feature must be promoted to shared code when it is useful to more than one module and does not encode a module-owned business rule.

Shared code must not know about contact fields, planning scheduling rules, report templates, or future product-specific behavior. Modules adapt their read models and commands to the shared API.

The shared workspace command bar owns responsive layout and no more than three
labelled groups: query, context, and actions. Its optional slots let modules
omit workflows they do not support. Query state, pagination semantics,
permissions, and mutations remain owned by the consuming module.

The shared overlay boundary owns transient popup position, the dedicated
localized move handle, pointer capture, keyboard movement and position reset,
safe-viewport clamping, and reset-on-open behavior for `WorkspacePopup` and
`WorkspaceEditorPopup`. Consuming modules own dialog content, validation, and
business commands; they must not add separate drag implementations. Movement
must preserve the shared focus trap, background isolation, dismissal lock,
scrolling, focus restoration, and responsive accessibility contract.

## Module Responsibilities

Modules still own:

- domain models, migrations, commands, events, permissions, and read models;
- Planning scheduling math, dependency validation, Gantt timeline drawing, and critical path logic;
- Contacts duplicate matching, party relationships, and derived intelligence profiles;
- Reports format rendering, artifact metadata, storage, download, and verification.

## Implementation Rules

- Backend shared helpers live in `src/uok` only when they are product-neutral runtime infrastructure.
- Frontend shared primitives live in `web/src/shared`.
- Module-local compatibility adapters may remain when tests or call sites depend on an existing module API, but they must delegate reusable behavior to shared code.
- Server-backed exports should use `reports.core` when the requested format is declared by the reports module.
- Browser-only visual exports may remain module-local until a matching reports adapter exists.

## Validation

Shared feature changes must pass:

```powershell
python -m compileall -q src modules tests conftest.py
python scripts/run_python_tests.py
npm --prefix web run check:contracts
npm --prefix web test
npm --prefix web run build
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
```

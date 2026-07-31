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
| Workspace command-bar layout, accessible query/context/action grouping, and common localized action vocabulary | `web/src/shared/layout`, `web/src/shared/actions`, `web/src/shared/localization`, and `web/src/shared/primitives` | Apps, Calendar, Communications, Contacts, and Planning through optional composition slots |
| Table column visibility, resize, order, pinned columns, and row heights | `web/src/shared/tables` | Contacts and Planning |
| Bounded pagination controls and accessible range announcements | `web/src/shared/tables` | Contacts and Planning portfolio |
| Toggle, command, icon, and segmented controls | `web/src/shared/primitives` | Contacts and Planning |
| Bounded draggable modal workspace overlays and editor composition | `web/src/shared/overlays` | Communications, Contacts, and Planning |
| Consequential-command confirmation, async state, and recoverable module render containment | `web/src/shared/overlays` and `web/src/shared/feedback` | Shell and module workspaces |
| Request-authoritative async epochs, independent owner lanes, guarded one-shot callbacks, cooperative cancellation, and stale-state masking | `web/src/shared/request-authority`, atomic shell session state, and the neutral module surface contract | Shell in Delivery 6a; Compliance reads in 6b and commands in 6c; Contacts primary list/group/detail reads in 6d; remaining Contacts and module-owner paths through phased Delivery 6 adoption |
| Empty states, status pills, detail items, and fact lists | `web/src/shared/data-display` | Apps, Contacts, Planning |
| Skip path, focus visibility, coarse-pointer target sizing, closed-panel semantics, and representative 320 CSS-pixel reflow proof | `web/src/App.tsx`, `web/src/styles/accessibility.css`, shared primitives, and `web/e2e/accessibility.spec.ts` | Shell and shared-primitives consumers; protected narrow proof currently covers the shell and Planning |
| Frontend dependency, lint, logical-style, generated-contract, accessibility, test, and bundle-budget gates | `web/scripts`, root/web lint configs, `scripts/frontend_quality_policy.py`, and CI | Every shell, shared, and module frontend change |

## Promotion Rule

A feature must be promoted to shared code when it is useful to more than one module and does not encode a module-owned business rule.

Shared code must not know about contact fields, planning scheduling rules, report templates, or future product-specific behavior. Modules adapt their read models and commands to the shared API.

The shared workspace command bar owns responsive layout and no more than three
labelled groups: query, context, and actions. Its optional slots let modules
omit workflows they do not support. Query state, pagination semantics,
permissions, and mutations remain owned by the consuming module.

ADR-0025 assigns common action labels, localization keys, one-primary-action
discipline, and duplicate-command prevention to the shared boundary. Consuming
modules supply domain nouns, contextual values, permissions, options, loading
state, handlers, and validation. A module may not create a competing command
bar or feature-local synonym for a standard action without a documented
exception.

The shared overlay boundary owns transient popup position, the dedicated
localized move handle, pointer capture, keyboard movement and position reset,
safe-viewport clamping, and reset-on-open behavior for `WorkspacePopup` and
`WorkspaceEditorPopup`. Consuming modules own dialog content, validation, and
business commands; they must not add separate drag implementations. Movement
must preserve the shared focus trap, background isolation, dismissal lock,
scrolling, focus restoration, and responsive accessibility contract.

The request-authority boundary owns only monotonic epochs, newest-ticket
ownership within named lanes, cooperative abort signals, guarded callbacks, and
epoch freshness checks. The shell owns the atomic authentication session and
the generated registry owns the exact per-surface activity signal. Each module
still owns the authority transitions caused by its capabilities, operational
state, criteria, selected entity, and lifetime. Shared request authority does
not own endpoint definitions, DTO decoding, domain errors, command idempotency,
replay policy, server reconciliation, commands, or workflow state. Those
remain module-owned.

## Module Responsibilities

Modules still own:

- domain models, migrations, commands, events, permissions, and read models;
- Planning scheduling math, dependency validation, Gantt timeline drawing, and critical path logic;
- Contacts duplicate matching, party relationships, and derived intelligence profiles;
- Reports format rendering, artifact metadata, storage, download, and verification.

## Implementation Rules

- Backend shared helpers live in `src/uok` only when they are product-neutral runtime infrastructure.
- Frontend shared primitives live in `web/src/shared`.
- New or materially changed frontend async work must use owner-local request
  authority. Every success, failure, loading finalizer, host refresh, and
  unauthorized callback must be guarded by the same current ticket; reusable
  state must carry the authority epoch. Existing owners migrate through the
  phased Delivery 6 audit plan.
- Module-local compatibility adapters may remain when tests or call sites depend on an existing module API, but they must delegate reusable behavior to shared code.
- Server-backed exports should use `reports.core` when the requested format is declared by the reports module.
- Browser-only visual exports may remain module-local until a matching reports adapter exists.

## Validation

Shared feature changes must pass:

```powershell
python -m compileall -q src modules tests conftest.py
python scripts/run_python_tests.py
npm --prefix web run check:contracts
npm --prefix web run check:dependencies
npm --prefix web run lint
npm --prefix web run lint:styles
npm --prefix web test
npm --prefix web run test:accessibility
npm --prefix web run build:static
npm --prefix web run check:bundle-budget
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
```

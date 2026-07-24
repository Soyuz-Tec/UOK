# Communications Core Module Plan

**Status:** Initial thread-provider slice runtime-proven

**Current candidate:** `UOK-3.1.0-alpha.3`

## Purpose

`communications.core` provides organization-scoped K Connect thread identity
and access as an optional UOK capability module. ADR-0008 governs its ownership
boundary and its integration with Planning typed links.

## Current Scope

- idempotent `CreateCommunicationThread` command;
- organization-scoped thread list and detail reads;
- controlled open, closed, and archived lifecycle states;
- operations/trader read-edit, viewer read-only, and fail-closed finance access;
- correlated `CommunicationThreadCreated` event evidence;
- module install, enable, disable, and verify lifecycle;
- K Connect workspace with thread creation, list, exact deep-link selection,
  thread context display, and the shared workspace command surface;
- client-side search across the currently authorized thread read model, status
  and context filters, updated/title sorting, locally persisted saved searches,
  refresh, and a blank governed thread-creation editor;
- Planning `communication_thread` resolution without a cross-module foreign
  key or copied provider payload.

## Ownership

Module-owned source and the canonical `CommunicationThread` SQLAlchemy mapping
live under `modules/communications.core`. The former root compatibility alias
is retired; the host registers the mapping from the module manifest. The K
Connect production
surface and CSS live under `modules/communications.core/web/src`, its frontend
tests live under `modules/communications.core/tests/web`, and the generated
catalog composes its validated manifest entry through the shared surface registry.

## Deferred Work

- message exchange and attachment records;
- membership and mention policy;
- close, reopen, archive, and retention commands;
- notifications, unread counts, server-side or message-content search, bounded
  thread pagination, and delivery integrations;

## Validation

```powershell
python -m pytest modules/communications.core/tests modules/planning.core/tests/test_planning_communication_links.py -q
npm --prefix web test -- --run ../modules/communications.core/tests/web/CommunicationsWorkspace.test.tsx src/app/workbenchNavigation.test.ts ../modules/planning.core/tests/web/PlanningOperationLinksPanel.test.tsx
npm --prefix web run test:ui-proof
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```

The candidate verifier proves create/read, audit correlation, role denial,
provider disable/enable behavior, and the exact Planning-to-K Connect thread
jump. PostgreSQL catalog readback and the six-scenario Chromium suite also pass.

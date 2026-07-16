# Communications Core Module Plan

**Status:** Thread provider and recoverable lifecycle slice runtime-proven

**Current candidate:** `UOK-3.1.0-alpha.3`

## Purpose

`communications.core` provides organization-scoped K Connect thread identity
and access as an optional UOK capability module. ADR-0008 governs its ownership
boundary and its integration with Planning typed links. ADR-0028 governs
recoverable Delete/Restore and optimistic concurrency.

## Current Scope

- idempotent `CreateCommunicationThread`, `ArchiveCommunicationThread`, and
  `RestoreCommunicationThread` commands;
- organization-scoped active, archived, and all-thread list reads plus exact
  detail reads;
- controlled open, closed, and archived lifecycle states;
- exact prior-state restoration, retained identity/audit evidence, and no
  cross-module delete cascade;
- positive per-thread revisions, strong ETags, required `If-Match`, row-locked
  mutation reads, and structured stale reload/reconfirm repair;
- operations/trader read-edit, viewer read-only, and fail-closed finance access;
- server-projected read/create/delete/restore capabilities;
- correlated created, archived, and restored event evidence;
- module install, enable, disable, and verify lifecycle;
- K Connect workspace with thread creation, list, exact deep-link selection,
  thread context display, recoverable Delete/Restore controls, stable Archived
  discovery, and the shared workspace command surface;
- client-side search across the currently authorized thread read model, status
  and context filters, updated/title sorting, locally persisted saved searches,
  refresh, and a blank governed thread-creation editor;
- Planning `communication_thread` resolution without a cross-module foreign
  key or copied provider payload; archived threads resolve unavailable and the
  same link becomes ready again after Restore.

## Ownership

Module-owned source and the canonical `CommunicationThread` SQLAlchemy mapping
live under `modules/communications.core`. The legacy
`src/uok/communication_models.py` path is an exact-class compatibility facade.
The mapping is registered from the module manifest. The K Connect production
surface and CSS live under `modules/communications.core/web/src`, its frontend
tests live under `modules/communications.core/tests/web`, and the generated
catalog composes its validated manifest entry through the shared surface registry.

## Deferred Work

- message exchange and attachment records;
- membership and mention policy;
- close, reopen, explicit retention, and purge commands;
- notifications, unread counts, server-side or message-content search, bounded
  thread pagination, and delivery integrations;

## Validation

```powershell
python -m pytest modules/communications.core/tests modules/planning.core/tests/test_planning_communication_links.py -q
npm --prefix web test -- --run ../modules/communications.core/tests/web/CommunicationsWorkspace.test.tsx ../modules/communications.core/tests/web/CommunicationsWorkspace.lifecycle.test.tsx src/app/workbenchNavigation.test.ts ../modules/planning.core/tests/web/PlanningOperationLinksPanel.test.tsx
npm --prefix web run check:contracts
npm --prefix web run test:ui-proof
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```

The candidate verifier proves create/read, recoverable Delete/Restore, exact
validator continuity, audit correlation, role denial, provider disable/enable
behavior, and the exact Planning-to-K Connect thread jump. PostgreSQL catalog
readback and the Chromium proof suite also pass.

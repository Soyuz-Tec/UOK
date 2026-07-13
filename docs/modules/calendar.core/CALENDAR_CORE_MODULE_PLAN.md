# Calendar Core Module Plan

**Status:** Active module plan.

**Current candidate:** `UOK-3.1.0-alpha.3`

## Purpose

`calendar.core` provides reusable organization calendars, events, recurrence,
persisted reminder definitions, free/busy-derived availability context, and
iCalendar export for UOK modules. It is a shared capability module, not
app-local scheduling code.

The accepted improvement direction is an internal collaborative Calendar first:
privacy and recurrence correctness, dependable participant/reminder semantics,
a scalable traditional workspace, working-hour and resource availability, and
then provider adapters.
Public appointment booking is a separate future `appointments.core` capability
under ADR-0026.

## Implemented UI Scope

- Traditional Calendar workspace with Month, Week, Day, and Agenda views.
- Shared workspace command bar with event search and saved-search options, calendar selector, Today, previous/next navigation, view switching, New event, Refresh, and ICS export.
- Mini month picker and a bounded, searchable scope selector for all Calendars
  or one Calendar, with validated per-Calendar color presentation.
- Visual event blocks on month and agenda views plus a complete 24-hour
  Week/Day grid with midnight clipping and overlap lanes.
- Shared draggable event editor for create and update flows, including focus
  restoration and nondismissible save/cancel/restore operations.
- Event fields for title, location, start/end, all-day, busy/free transparency, recurrence, recurrence-until, reminder minutes, participant name/email, and description.
- Event cancellation and restore actions.
- Recurring occurrences open as an explicitly labeled whole-series editor;
  cancellation and restoration require whole-series confirmation while
  recurrence exceptions remain deferred.
- Free/busy count surfaced in the workspace summary.

## Backend Scope

- Calendar CRUD.
- Event create/read/update, cancellation, and restore; hard event deletion is
  not exposed.
- Atomic participant and reminder replacement on event create/update, with
  bounded inputs and controlled participant/RSVP values.
- Persisted reminder definitions. UOK does not yet dispatch in-app or email
  reminders; ICS export includes active definitions as `VALARM` entries.
- Opaque free/busy endpoint with actor-visible active-parent filtering.
- ICS export with UTF-8 byte-aware folding, all-day values, attendee state,
  transparency, bounded recurrence, alarms, local timed `TZID` values, and one
  size-bounded `VTIMEZONE` definition per referenced IANA zone.
- Safe IANA-timezone RRULE validation and DST-aware expansion for daily,
  weekly, monthly, and yearly recurrence, including stored end boundaries.
  The alpha contract is finite at 366 effective occurrences: omitted boundaries
  normalize to `COUNT=366`, over-limit explicit boundaries fail closed, and
  legacy read/export evaluation is bounded from the series start. RRULEs that
  combine `COUNT` and `UNTIL` are rejected in accordance with RFC 5545. New
  writes also enforce a 366-year effective horizon and a 366-day event-duration
  limit; overflow-safe reads contain pre-policy legacy rows.
- Organization-scoped data, permission-gated APIs, and fail-closed
  private/reserved-team visibility.
- Strong event ETags and mandatory preconditions protect event updates,
  lifecycle changes, and standalone reminder mutations from stale-client lost
  updates.
- Lifecycle status is governed only by dedicated cancel/restore commands.

## Boundaries

- `calendar.core` owns shared calendar records and free/busy-derived
  availability context.
- `planning.core` may consume actor-visible Calendar free/busy context, but
  Planning owns Gantt scheduling rules.
- External sync adapters such as Google Calendar, Microsoft Outlook, CalDAV, and ICS import remain future adapter work.
- Calendar reads require an actor-visible active parent. Managers may administer
  organization Calendar records, owners may read their own records, and
  organization visibility is available to authorized readers.
- `team` visibility is reserved and fails closed to owner/manager access until
  UOK has a canonical team-membership provider and Calendar team reference.
- Free-busy API results are opaque intervals. Internal actor-authorized Planning
  correlation may retain event context without broadening the public contract.
- Provider synchronization must use module-owned ports, encrypted credential
  references, cursors, idempotent jobs, verified webhooks, retry/dead-letter
  behavior, and explicit reconciliation before two-way editing is enabled.

## Completed In This Slice

1. Integrity: active-parent visibility, opaque free-busy, strong ETag updates,
   lifecycle permission separation, timezone-aware bounded recurrence, true
   all-day boundaries, explicit participant/reminder replacement, and ICS
   injection hardening.
2. Workspace foundation: shared draggable event editor, scroll-bounded
   searchable all-or-one Calendar scope, multi-calendar colors, complete
   24-hour geometry, overlap lanes, inline errors, and keyboard-roving slots.

## Next Increments

1. Workspace interaction: arbitrary Calendar subsets, drag-to-create,
   drag/drop, resize, current-time line, and continuous multi-day bands.
2. Availability and resources: weekly schedules, date overrides, buffers,
   minimum notice, rooms/equipment, and transactional collision prevention.
3. Interoperability: recurrence exceptions and RFC 5545 round-trip behavior,
   CalDAV, then one-way Google and Microsoft free-busy ingestion before
   controlled two-way synchronization.
4. Optional appointments: a separate module for public links, slot holds, guest
   confirmation, rescheduling, cancellation, notifications, and webhooks.

## Validation

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Audit
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action EngineeringEvidence
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify -BaseUrl http://127.0.0.1:18088
```

The standard gates run the complete Python and frontend suites, including the
Calendar editor/selector/layout/presentation, recurrence, visibility, ICS,
optimistic-concurrency, and Planning privacy coverage.

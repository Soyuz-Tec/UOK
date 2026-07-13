# ADR-0026: Calendar Integrity And Appointments Boundary

**Status:** Accepted

**Date:** 2026-07-13

**Current candidate:** `UOK-3.1.0-alpha.3`

## Context

`calendar.core` already owns organization calendars, events, recurrence,
participants, reminders, free-busy reads, Planning availability context,
iCalendar export, and the traditional Calendar workspace. Review against the
running UOK candidate and current scheduling references found that its next
constraint is correctness and privacy rather than booking feature breadth.

The current model stores `private`, `team`, and `organization` visibility, but
Calendar reads have historically been organization-wide. Calendar also has no
canonical team identifier or team-membership provider. Treating `team` as
organization-visible would disclose event data, while inventing a Calendar-only
membership model would create a second identity boundary.

External products combine several different concerns: collaborative calendars,
CalDAV interoperability, external-provider synchronization, availability and
slot calculation, and public appointment booking. Importing one of those
products or merging every concern into `calendar.core` would weaken UOK's
module ownership and selected Python/FastAPI/PostgreSQL plus React stack.

## Decision

1. `calendar.core` remains UOK's internal collaborative event and availability
   authority. Planning may consume actor-visible availability context, but
   Planning remains the project-schedule authority.
2. Calendar access fails closed through one module-owned policy:
   - records must belong to the actor's organization and have an active parent
     Calendar;
   - actors with Calendar management authority may administer organization
     Calendar records;
   - owners may read their own Calendar records;
   - `organization` Calendars are readable to authorized organization readers;
   - `private` and `team` Calendars are not disclosed to other readers.
3. `team` remains accepted for stored/API compatibility but is reserved until a
   canonical UOK team-membership provider and a Calendar team reference are
   approved. It must not silently mean organization-wide access.
4. Free-busy is an availability contract. Public API responses expose bounded
   busy intervals without event titles or identifiers unless a separate,
   actor-authorized internal read model explicitly requires event context.
5. Calendar recurrence is evaluated in the event's stored IANA timezone,
   respects the stored end boundary, and is finite under the alpha contract:
   at most 366 effective occurrences. New rules without `COUNT`, `UNTIL`, or a
   stored boundary normalize to `COUNT=366`; explicit boundaries beyond the
   limit are rejected. Legacy reads and ICS export also use bounded iteration so
   distant or malformed series cannot amplify CPU work. RRULEs containing both
   `COUNT` and `UNTIL` are rejected as RFC 5545-invalid. Participant and reminder
   editing must be explicit replacement semantics rather than silently ignored
   or duplicated.
   Persisted reminders are not described as delivered notifications until a
   dispatch worker, retries, and delivery evidence exist; ICS may export them as
   client-side alarms.
   Event updates, lifecycle changes, and standalone reminder mutations require
   a current strong event ETag so stale clients cannot replace or reorder newer
   event and child state. Lifecycle status is changed only through the dedicated
   cancellation and restore commands.
6. Timed iCalendar export preserves the event's recurrence basis: UTC events
   use UTC values, while non-UTC events use local `DTSTART`/`DTEND` with an IANA
   `TZID` and one bounded `VTIMEZONE` per referenced zone. Timed `UNTIL` remains
   UTC as required by RFC 5545. UOK pins BSD-2-Clause `icalendar` `7.2.0` only
   for standards parsing/serialization and bounded VTIMEZONE generation; UOK
   retains recurrence, event, command, and storage ownership.
7. The Calendar workspace uses the shared UOK command surface and shared
   draggable editor popup. Multi-calendar presentation must reuse server-side
   actor visibility, and stored Calendar colors must be validated before use.
8. External provider synchronization is added later through module-owned ports,
   encrypted credential references, cursors, idempotent jobs, verified
   webhooks, retry/dead-letter behavior, and explicit conflict resolution.
9. If UOK adds public appointment booking, it belongs in a separate optional
   `appointments.core` capability. That module consumes Calendar availability
   and creates confirmed Calendar events through governed commands; it does not
   take ownership of Calendar events or Planning dates.
10. UOK may adopt behavior and protocol lessons from current calendar products,
   RFC 5545, CalDAV, and provider APIs, but it will not vendor another product,
   import a second application stack, or copy license-incompatible source.

## Consequences

- Calendar privacy and parent lifecycle become prerequisites for all-calendar
  overlays, ICS export, free-busy, and Planning availability reads.
- Existing `team` Calendars become owner/manager-visible until an explicit team
  model exists. This is intentionally restrictive and avoids false sharing.
- Recurrence, attendee, reminder, and interoperability behavior can mature
  without changing UOK's runtime stack or Planning authority.
- RFC-conformant timezone export adds one pinned, narrow interoperability
  dependency plus bounded generation, cache, and serialized-size controls.
- Public booking, abuse controls, guest verification, slot holds, outbound
  notifications, and booking webhooks do not expand `calendar.core`.
- Provider synchronization remains deferred even with guarded local event
  writes; recurrence exceptions, reconciliation, and sync observability are not
  yet proven.

## Alternatives Considered

- **Fork or embed cal.diy, Nextcloud Calendar, Easy!Appointments, or Radicale.**
  Rejected because their product boundaries, stacks, and operating models do
  not match UOK's module contract; some also use incompatible copyleft licenses.
- **Treat `team` as organization visibility.** Rejected because UOK Calendar has
  no team-membership evidence and the behavior would disclose private data.
- **Put booking directly in `calendar.core`.** Rejected because public slot
  discovery, guest identity, booking holds, and booking lifecycle form a
  separate capability and threat boundary.
- **Build two-way provider synchronization first.** Rejected because it would
  multiply current privacy, recurrence, conflict, and concurrency defects.
- **Emit local IANA `TZID` values without `VTIMEZONE`.** Rejected because RFC
  5545 requires a matching definition that covers every recurrence instance;
  relying on a consumer's private timezone registry is not portable.
- **Hand-build IANA transition components.** Rejected because transition
  discovery, historical rule changes, fixed-offset zones, folding, and bounded
  range generation are standards-library concerns with high interoperability
  risk and no UOK domain value.

## References

- [RFC 5545: Internet Calendaring and Scheduling Core Object Specification](https://datatracker.ietf.org/doc/html/rfc5545)
- [RFC 4791: Calendaring Extensions to WebDAV (CalDAV)](https://datatracker.ietf.org/doc/rfc4791/)
- [RFC 6578: Collection Synchronization for WebDAV](https://datatracker.ietf.org/doc/html/rfc6578)
- [Nextcloud Calendar user documentation](https://docs.nextcloud.com/server/stable/user_manual/en/groupware/calendar.html)
- [Nextcloud CalDAV administration documentation](https://docs.nextcloud.com/server/stable/admin_manual/groupware/calendar.html)
- [Easy!Appointments features and integration boundary](https://easyappointments.org/features/)
- [cal.com self-hosted repository](https://github.com/calcom/cal.com)

## Validation

- API tests prove owner/manager access, hidden private/team Calendar behavior,
  active-parent enforcement, opaque free-busy, and ICS/Planning privacy.
- Recurrence tests cover stored end boundaries and wall-clock behavior across
  daylight-saving transitions, including independent expansion of parsed TZID
  exports and the 366-occurrence external bound.
- Event API tests prove guarded participant/reminder replacement, lifecycle
  permission separation, all-day normalization, stale-editor rejection, and
  recovery guidance.
- Frontend tests prove one shared command surface, a scroll-bounded client-side
  searchable Calendar selector,
  multi-calendar color presentation, one positioned time segment per event,
  popup focus restoration, and nondismissible committed work.
- Run Calendar and Planning integration tests, frontend tests, static build,
  `TechnologyAudit`, `Audit`, `Verify`, Podman `Rebuild`, and live browser proof
  before publication.

# Calendar Core Deployment Note

**Status:** Active module deployment note.

**Current candidate:** `UOK-3.1.0-alpha.3`

`calendar.core` is the optional UOK global calendar capability. It is a reusable platform service, not app-local scheduling code.

## Implemented Scope

- Closed module manifest with validated UOK extension points and a compile-time workbench surface.
- Manifest-mounted API router, command handlers, command permissions, role grants, and model exports.
- Calendar CRUD plus event create/read/update, cancellation, and restore;
  hard event deletion is not exposed.
- Atomic participant editing and persisted reminder definitions,
  timezone-aware bounded recurrence, opaque free-busy-derived availability
  context, and iCalendar export with attendees and `VALARM` definitions.
- Module-owned Month, Week, Day, and Agenda React workspace with a shared
  draggable editor, searchable Calendar scope, stored colors, and complete
  24-hour event geometry.
- Module-owned tests and candidate verification.

## Security And Correctness Controls

- Every table is organization-scoped.
- Calendar, event, free-busy, Planning availability-context, and ICS reads
  require an actor-visible active Calendar parent. Direct hidden targets return
  generic not-found behavior; collection, free-busy, Planning, and ICS
  projections omit hidden records without disclosing that they exist.
- `organization` visibility is readable to authorized organization readers;
  owners and Calendar managers retain their authorized paths. `private` and the
  reserved `team` scope fail closed for other readers.
- The public free-busy contract returns opaque busy intervals without event
  titles or identifiers.
- Every endpoint verifies `calendar.core` is operational before use.
- Full event reads, free-busy, and iCalendar export use distinct permissions.
- Recurrence is limited to daily, weekly, monthly, and yearly frequencies; counts, expansion windows, and generated occurrences are bounded.
- Recurrence expands in the stored IANA time zone across DST, and all-day event
  storage is normalized to exclusive local-date boundaries.
- Timed non-UTC iCalendar values use `TZID` plus a deduplicated, range-bounded
  `VTIMEZONE`; recurrence masters are exported only when a duration-aware
  occurrence overlaps the requested range. UTC and all-day values retain their
  RFC-native forms.
- New writes reject event durations over 366 days, dates outside years 2-9998,
  recurrence horizons over 366 years, and recurrence counts over 366. Legacy
  reads use overflow-safe arithmetic; oversized legacy timezone exports fail
  with a controlled error before transition generation can amplify work.
- Event updates, cancellation/restoration, and standalone reminder mutations
  require the exact strong ETag from the latest detail response; stale or
  missing preconditions cannot alter event or child state.
- Lifecycle status is changed only through cancellation/restore commands with
  their dedicated permissions and timestamp invariants.
- User-supplied datetimes require timezone offsets and stored datetimes normalize to UTC for read/export behavior.
- iCalendar output normalizes control characters, safely encodes attendee
  parameters, and folds long lines by UTF-8 octets.

## Deliberately Deferred

- iCalendar import, CalDAV, Google Calendar, and Microsoft Outlook adapters.
- UOK in-app/email reminder dispatch, retry, and delivery-observability workers.
- Working-hour/override availability schedules, slot calculation, holds, and
  public booking.
- Resource-room/equipment exclusion constraints.
- PostgreSQL range-based occurrence caching.
- Shared-user ACLs and canonical team membership beyond owner, Calendar manager,
  and organization visibility rules.
- Public appointment booking, which belongs in a separate future
  `appointments.core` capability under ADR-0026.

These are later adapters or capability increments and must not be described as current deployment behavior.

## Candidate Verification Data Neutrality

`calendar.core` participates in Candidate Data Neutrality v1. Its own verifier
and any consumer proof that creates Calendar or Contact data must leave no
user-visible or recoverable Calendar aggregate, event, participant, reminder,
or temporary Contact after success or failure.

The normal retained Calendar Delete and Contact Archive paths preserve
recoverability and therefore do not satisfy this verification invariant.
Qualification must use rollback, disposable isolated state, or a governed
verifier-only purge. Cleanup errors are reported separately without replacing
the primary proof error. Historical cleanup requires a reviewed exact ID list,
the SHA-256 digest of the sorted IDs, explicit exclusions, and post-cleanup
evidence.

## Developer Verification

From the repository root, run the standard `Verify` operation twice against the
same candidate and confirm a zero retained Calendar/Contact fixture delta.
Then install `calendar.core` through Apps Manager before using its API or
workspace. The active local candidate is served through the repository's
Podman compose profile; production deployment is outside this note's claim.

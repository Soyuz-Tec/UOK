# Calendar Core Deployment Note

**Status:** Active module deployment note.

**Current candidate:** `UOK-3.1.0-alpha.3`

`calendar.core` is the optional UOK global calendar capability. It is a reusable platform service, not app-local scheduling code.

## Implemented Scope

- Closed module manifest with validated UOK extension points and a compile-time workbench surface.
- Manifest-mounted API router, command handlers, command permissions, role grants, and model exports.
- Calendar and event create, read, update, cancellation, and restore workflows.
- Participants, reminders, bounded recurrence, free-busy, availability, and iCalendar export.
- Module-owned Month, Week, Day, and Agenda React workspace with event editing and range/calendar controls.
- Module-owned tests and candidate verification.

## Security And Correctness Controls

- Every table is organization-scoped.
- Every endpoint verifies `calendar.core` is operational before use.
- Full event reads, free-busy, and iCalendar export use distinct permissions.
- Recurrence is limited to daily, weekly, monthly, and yearly frequencies; counts, expansion windows, and generated occurrences are bounded.
- User-supplied datetimes require timezone offsets and stored datetimes normalize to UTC for read/export behavior.
- iCalendar output escapes text and folds long content lines.

## Deliberately Deferred

- iCalendar import, CalDAV, Google Calendar, and Microsoft Outlook adapters.
- Resource-room/equipment exclusion constraints.
- PostgreSQL range-based occurrence caching.
- Per-user private sharing ACLs beyond current role permissions.

These are later adapters or capability increments and must not be described as current deployment behavior.

## Developer Verification

From the repository root, run the standard `Verify` operation. Then install `calendar.core` through Apps Manager before using its API or workspace. The active local candidate is served through the repository's Podman compose profile; production deployment is outside this note's claim.

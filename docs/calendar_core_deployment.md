# calendar.core Deployment Note

`calendar.core` is the UOK global calendar capability module. It is designed as a reusable platform service, not as app-local scheduling code.

## Implemented scope

- Module manifest with UOK extension points.
- Dynamic API router registration through `api_router`.
- Dynamic command registration through `command_handlers` and `command_permissions`.
- Dynamic role grants through `role_grants`.
- Model ownership export through `model_exports`.
- Calendar CRUD.
- Calendar event CRUD, cancellation, and restore.
- Participants on event creation.
- Reminders.
- Free/busy endpoint.
- ICS export.
- Basic safe RRULE validation and expansion.

## Security and correctness controls

- Every table is organization-scoped.
- Every endpoint verifies `calendar.core` is operational before use.
- Full event reads use `calendar.read`.
- Free/busy uses separate `calendar.freebusy.read`.
- ICS export uses separate `calendar.ics.export`.
- Recurrence is intentionally limited to daily, weekly, monthly, and yearly frequencies in the first release.
- RRULE `COUNT` is capped.
- Expansion windows and generated occurrences are capped.
- User-supplied datetimes must include timezone offsets.
- Stored datetimes are normalized to UTC for read/export behavior.
- ICS output escapes text and folds long content lines.

## Deferred deliberately

- ICS import.
- CalDAV sync.
- Google Calendar sync.
- Microsoft Outlook sync.
- Resource-room/equipment exclusion constraints.
- PostgreSQL `tstzrange` occurrence cache.
- Per-user private sharing ACLs beyond role permissions.

These are adapter or phase-two capabilities and should not be mixed into the first deployable kernel slice.

## Developer verification

Run:

```powershell
python -m compileall -q src modules
python -m pytest -q
python -m pip_audit -r requirements.txt
cd web
npm run test
npm run build:static
```

Then install `calendar.core` through Apps Manager before using `/api/calendar/*` endpoints.

# Calendar Core Tests

Calendar Python tests live in this canonical module-owned test root. Calendar
frontend tests live under `modules/calendar.core/tests/web` and are discovered
by the shared Vitest configuration:

```powershell
npm --prefix web test -- --run ../modules/calendar.core/tests/web
```

Production Calendar React source and local CSS remain separate under
`modules/calendar.core/web/src`.

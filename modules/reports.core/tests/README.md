# reports.core tests

Reports Python tests live in this canonical module-owned test root and are
discovered by the repository test runner. Frontend client tests live under
`modules/reports.core/tests/web` and are discovered by Vitest:

```powershell
npm --prefix web test -- --run ../modules/reports.core/tests/web/serverReports.test.ts
```

The corresponding production client remains under
`modules/reports.core/web/src`, outside the test root.

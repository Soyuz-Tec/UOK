# reports.core web surface

The first reports.core release exposes backend APIs, command handlers, and a shared frontend client under `web/src/shared/exporting/serverReports.ts`.

Future UI components should provide a shared export button and artifact download panel that call `/api/reports` instead of embedding per-app export logic. Planning now uses this shared path for CSV, JSON, and Markdown schedule artifacts while keeping SVG local until an image renderer is declared.

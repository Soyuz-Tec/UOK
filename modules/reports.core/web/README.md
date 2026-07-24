# reports.core web surface

Reports owns its typed report HTTP client under
`modules/reports.core/web/src/serverReports.ts` and its frontend client tests
under `modules/reports.core/tests/web`. Generic local export-artifact helpers
remain module-neutral under `web/src/shared/exporting`.

Reports currently has no workbench page, so its manifest does not declare
`web_surface`, `web_entry`, or `web_section`, and it is absent from the generated
surface catalog. Planning imports the Reports-owned typed client for CSV, JSON,
and Markdown schedule artifacts while keeping SVG local until an image renderer
is declared. Future Reports UI can add the canonical module surface only with
the closed manifest fields, catalog generation, module-local CSS, and module
frontend tests.

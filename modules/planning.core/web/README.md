# planning.core web

Planning owns its production React/Gantt source and local CSS under
`modules/planning.core/web/src`. Planning frontend tests live under
`modules/planning.core/tests/web`, alongside the module's Python tests under the
same canonical test root.

The closed manifest declares `web_surface`, the canonical
`modules/planning.core/web/src/moduleSurface.tsx` `web_entry`, and the unique
`planning` `web_section`. The generated compile-time catalog emits its literal
TypeScript import after manifest validation. The browser never reads YAML or
loads a dynamic module path. The current surface uses the intentionally
transitional shared shell host for token, appearance, lifecycle, and activation
context; scheduling behavior remains in the owning backend.

Python module service first, with React UI receiving validated schedule read models.

Planning imports the typed Reports client from
`modules/reports.core/web/src/serverReports.ts` for server-generated report
artifacts while Reports retains transport ownership. Module CSS is loaded from
Planning's surface entry; product-neutral controls, tokens, and generated API
contracts remain in `web/src`.

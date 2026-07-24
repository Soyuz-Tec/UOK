# Apps Manager Web

Apps Manager owns its production React source and CSS under
`modules/apps.manager/web/src` and its frontend tests under
`modules/apps.manager/tests/web`. The canonical surface entry is
`modules/apps.manager/web/src/moduleSurface.tsx`.

The closed manifest declares `web_surface`,
`modules/apps.manager/web/src/moduleSurface.tsx` as `web_entry`, and `apps` as
`web_section`. The generated compile-time frontend catalog emits a literal
TypeScript import for that entry; the browser never reads the manifest or loads
a dynamic module path. Apps Manager is still the required bootstrap control
module, but its navigation and rendering use the same typed surface registry as
other workbench modules rather than a shell hardcode.

The surface presents runtime status separately from manifest maturity and
exposes actions only when lifecycle and operation flags allow them. Planned
modules remain visible without install or upgrade actions. Persisted status or
manifest-snapshot drift exposes a dedicated Reconcile action while normal
lifecycle actions remain suppressed. Module-specific styles stay local; shared
shell controls and tokens remain under `web/src`.

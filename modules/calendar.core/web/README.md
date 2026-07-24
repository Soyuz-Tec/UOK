# Calendar Core Web

Calendar owns its production React source and CSS under
`modules/calendar.core/web/src` and its frontend tests under
`modules/calendar.core/tests/web`. The canonical module entry is
`modules/calendar.core/web/src/moduleSurface.tsx`.

The closed manifest declares `web_surface`, that canonical `web_entry`, and the
unique `calendar` `web_section`. The generated compile-time catalog emits a
literal TypeScript import after manifest validation; the browser never reads
YAML or resolves a dynamic module path. The surface imports Calendar-local CSS
and adapts the transitional shared shell host into Calendar workspace props.
Product-neutral controls, tokens, generated API contracts, and shell behavior
remain under `web/src`.

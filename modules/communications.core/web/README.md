# communications.core web surface

Communications owns the K Connect React workspace and local CSS under
`modules/communications.core/web/src`; its frontend tests live under
`modules/communications.core/tests/web`. The canonical entry is
`modules/communications.core/web/src/moduleSurface.tsx`.

The closed manifest declares `web_surface`, that `web_entry`, and the unique
`communications` `web_section`. The generated compile-time catalog emits a
literal TypeScript import after manifest validation. The browser never reads
the YAML manifest or loads a runtime module path. The current surface adapts the
transitional shared shell host into the workspace's token, lifecycle, and
activation props; new K Connect behavior remains module-owned.

The workspace exposes server-projected create/delete/restore capabilities,
keeps Archived as a stable lifecycle filter, and uses the shared draggable
confirmation surface for recoverable Delete. Successful lifecycle responses
are committed locally. A stale validator reloads only the exact thread and
requires a new explicit confirmation; it is never retried automatically.

# Contacts Core Web

The Contacts UI is currently implemented in `web/src/features/contacts` and composed through `web/src/features/modules/moduleSurfaceRegistry.tsx`.

This directory is the module ownership marker for Contacts web assets. The next packaging step is moving module-specific UI source behind this module root while keeping shared shell components, shared controls, generated API contracts, and global design tokens in `web/src`.

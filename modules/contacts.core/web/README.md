# Contacts Core Web

Contacts owns its production React components, module-specific app hooks, and
local CSS under `modules/contacts.core/web/src`. Contacts frontend tests and
fixtures live under `modules/contacts.core/tests/web`.

The closed manifest declares `web_surface`, the canonical
`modules/contacts.core/web/src/moduleSurface.tsx` `web_entry`, and the unique
`contacts` `web_section`. The deterministic generated catalog supplies the
literal compile-time import to the typed registry; the browser never reads YAML
or resolves a dynamic module path.

The surface currently receives existing Contacts state and commands through the
shared Workbench host. That broad host is an intentionally transitional shell
compatibility bridge for this relocation, not the permanent module API and not
a destination for new Contacts behavior. Shared controls, design tokens,
generated contracts, and product-neutral shell state remain under `web/src`;
Contacts selectors and workflow styling stay module-local.

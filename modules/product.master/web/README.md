# product.master web surface

Product Master owns its React workspace, DTOs, HTTP client, command payloads,
filters, state, components, and CSS under `modules/product.master/web/src`.
Frontend tests live under `modules/product.master/tests/web`.

The canonical entry is `modules/product.master/web/src/moduleSurface.tsx`.
The closed manifest declares `web_surface`, that exact `web_entry`, and the
unique `products` section. The checked-in frontend catalog is generated from
the validated manifest; the browser does not read YAML or resolve a runtime
module path.

The surface consumes only the neutral `ModuleSurfaceHostContext`. It does not
import shell implementation state or another feature module. Product reads use
owner routes, writes use owner commands through the existing command bus, and
tenant identity always comes from the authenticated backend actor.

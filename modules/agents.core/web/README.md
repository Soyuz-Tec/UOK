# agents.core web

`agents.core` is an inert `planned` scaffold. Its manifest declares no
`web_surface`, `web_entry`, or `web_section`; no executable Agents code is
included in the generated frontend catalog or current workbench.

Future Agents UI notes belong here. Once backend capability, permissions,
tests, approval evidence, and maturity justify activation, production React and
local CSS must live under `modules/agents.core/web/src`, frontend tests under
`modules/agents.core/tests/web`, and the canonical surface must be declared in
the closed manifest. Reusable module-neutral workspace controls remain in
`web/src/shared`. The browser must never load this YAML manifest or a dynamic
module path.

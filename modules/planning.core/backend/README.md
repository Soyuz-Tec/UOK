# planning.core backend

Module-owned Python backend package for Planning APIs, commands, schedule
validation, read models, immutable revision/outbox history, dashboard counts,
evidence, and model exports.

The only supported Python entry for callers outside Planning is
`uok_planning_core.public_api`. It exposes the composed API router and the six
manifest provider functions. ORM registration is a privileged manifest hook at
`uok_planning_core._internal.persistence.models:owned_models`; it is not a
business API and must not be imported by another module.

Implementation is private and capability-organized below `_internal`:

- `delivery`
- `scheduling`
- `coordination`
- `resources`
- `analysis`
- `portfolio_audit`
- `persistence`

Planning-owned code and tests may use these packages. External production code,
engineering scripts, and other modules may not; the rule is executable in
`tests/test_module_public_api_boundaries.py`.

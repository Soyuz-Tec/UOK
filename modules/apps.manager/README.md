# apps.manager

**Status:** Active required control module.

**Current candidate:** `UOK-3.1.0-alpha.3`

`apps.manager` is the required UOK control module for manifest discovery, lifecycle state, reconciliation, and operator-visible module management.

Its manifest is the source of truth for the mounted API router, permissions, model exports, verifier, and workbench surface. Backend behavior lives under `modules/apps.manager/backend`; production React and CSS live under `modules/apps.manager/web/src`; frontend tests live under `modules/apps.manager/tests/web`; candidate proof lives under `modules/apps.manager/verify`.

The module may coordinate product-neutral lifecycle services from the kernel, but lifecycle UI and HTTP adaptation remain module-owned. Persisted runtime status and manifest maturity are separate facts and must remain visibly distinct.

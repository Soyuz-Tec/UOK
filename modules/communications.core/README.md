# communications.core

**Status:** Active optional capability module.

**Current candidate:** `UOK-3.1.0-alpha.3`

`communications.core` is the optional UOK K Connect capability for organization-scoped thread identity, authorized reads, lifecycle state, audit evidence, and exact workbench deep links.

Backend and ORM ownership live under `modules/communications.core/backend`; module migrations live under `modules/communications.core/migrations`; production React and CSS live under `modules/communications.core/web/src`; behavior and frontend tests live under `modules/communications.core/tests`; candidate proof lives under `modules/communications.core/verify`.

Planning stores typed thread references and resolves them through this provider. Communications retains identity, disclosure, authorization, and lifecycle authority; no cross-module foreign key transfers that ownership.

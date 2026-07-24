# ADR-0021: Module Manifest Runtime and Release Truth

**Status:** Accepted
**Date:** 2026-07-10

## Context

UOK uses `modules/<module_name>/manifest.yaml` as the catalog and extension boundary for its modular monolith. The earlier contract accepted undeclared keys and speculative extension names, mixed runtime validation with test and release assets, hard-mounted the Apps Manager API from the kernel, and located candidate verifiers below module test folders. Those gaps made a manifest appear authoritative while runtime and release behavior still depended on parallel hard-coded knowledge.

## Decision

1. Every module manifest uses schema `uok.module.v1` and declares one evidence-bounded maturity value: `planned`, `source_present`, `unit_tested`, `integration_tested`, or `runtime_proven`.
2. Manifest keys, scalar/list types, list uniqueness, lifecycle states, dependencies, and extension points are closed and fail unknown input.
3. Extension declarations are bidirectional. A registered hook requires its matching manifest field, and an extension-bearing field requires its registered hook. Speculative hooks are not declared before an implementation and loader exist.
4. Runtime validation covers only assets and imports needed to start and operate UOK. Release validation adds source ownership folders, module tests, candidate verifier assets, and maturity evidence. Runtime validation must not require a `tests/` directory.
5. Candidate verifiers live under `modules/<module_name>/verify`, are discovered through the canonical validated manifest catalog, and run in required/dependency order. Release tooling recursively parses every static dot-source helper once, permits only canonical literals in the owning module `verify/` directory or approved shared `scripts/verify` root, and rejects dynamic, unresolved, outside-root, linked, cyclic, or syntactically invalid closures. The declared verifier must appear as exactly one ordinary top-level function before any module script is dot-sourced.
6. Validated manifest `backend_path` values are the only module backend roots added to Python import resolution. Runtime validation finishes before extension-bearing imports execute. API prefixes are canonical, module-owned `/api/...` paths and cannot overlap another module's prefix.
7. The Apps Manager HTTP adapter belongs to `modules/apps.manager`; its manifest-mounted router calls shared lifecycle, persistence, authorization, and catalog services. The shared runtime does not hard-mount that module API.
8. Persisted module state that conflicts with current planned/required manifest truth is projected fail-closed. An authorized reconciliation action locks the organization and module record, updates the manifest snapshot without deleting data, and emits one auditable `ModuleLifecycleReconciled` event.
9. Every manifest uses the canonical `modules/<module_name>/tests` test path. Container stages exclude that closed path shape, validate manifest-discovered runtime-proven verifier assets, and prove the absence of module test directories. They do not carry a parallel hard-coded module list.
10. `agents.core` remains an inert `planned` scaffold. It cannot claim permissions, API routes, installability, upgradeability, maintenance, tests, or runtime readiness before those capabilities exist.

## Consequences

- Manifests become executable, testable truth instead of descriptive metadata.
- Runtime images may exclude module test suites while retaining module-owned release verifiers needed by production-like candidate probes.
- Invalid or overclaimed modules fail before extension loading or candidate script execution.
- Legacy installed records cannot make a now-planned module operational or satisfy dependencies; operators can reconcile that drift through Apps Manager without deleting evidence.
- Adding a new hook, maturity transition, or runtime asset now requires validator, test, and documentation changes.
- Existing module lifecycle services and database records remain kernel-owned, so this decision does not create a schema migration.

## Alternatives considered

- **Keep one validator for runtime and release.** Rejected because it forces test-only assets into runtime images and couples application startup to development layout.
- **Continue parsing manifests independently in PowerShell.** Rejected because a second parser can disagree with the application contract and dot-source unvalidated paths.
- **Keep Apps Manager routes in `src/uok`.** Rejected because it makes the required control module an exception to the same manifest-mounted API boundary enforced for capability modules.
- **Declare planned extension points in advance.** Rejected because it overstates implementation maturity and weakens closed-contract validation.

## Validation

- Strict loader and manifest contract tests cover unknown/duplicate keys, wrong types, duplicate list values, maturity, hooks, dependencies, cycles, and backend ownership.
- Runtime/release split tests prove runtime validation succeeds without test folders while release validation requires the declared evidence.
- Apps Manager API and lifecycle tests prove manifest mounting, authorization, required-module protection, inert planned-module behavior, locked idempotent reconciliation, and audit evidence.
- Candidate catalog tests prove safe module-owned paths, semantic PowerShell function validation, linked-root rejection, unique functions, and deterministic dependency order.
- Startup tests prove validation precedes extension execution and only validated manifest backend paths enter import resolution.
- API-prefix tests prove canonical, non-overlapping route ownership.
- Container inspection uses the same manifests to prove module tests are absent and every runtime-proven verifier remains available.
- The sequential Python suite, generated-contract check, frontend tests/build, rebuilt runtime health, and full candidate verifier complete before publication.

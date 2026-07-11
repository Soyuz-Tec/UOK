# ADR-0022: Module-Owned ORM Registration

**Status:** Accepted
**Date:** 2026-07-10
**Current candidate:** `UOK-3.1.0-alpha.3`

## Context

UOK manifests already declared table ownership, but 29 capability mappings were
physically defined below `src/uok`. Module `model_exports` providers imported
those mappings back through `uok.models`, and metadata completeness depended on
that compatibility module's import side effects. Moving definitions directly
without changing composition would either import extension code before the
manifest trust boundary, omit tables from `Base.metadata`, or create duplicate
SQLAlchemy class and table identities.

## Decision

1. `src/uok/db.py` owns the only declarative `Base` and metadata registry.
2. The nine product-neutral mappings for organizations, users, memberships,
   schema versions, governance rules, module lifecycle records, workflow
   instances, command logs, and event records live in `uok.kernel_models`.
3. Contacts, Calendar, Communications, Planning, and Reports define their 29
   exclusive mappings inside their owning backend packages. Planning keeps
   schedule, resource, analysis, and audit definitions in focused module-local
   files.
4. Runtime manifest validation remains static and completes before any
   extension package import. It validates ownership syntax, unique direct
   owners, explicit kernel shared-table scopes, dependencies, import target
   declarations, and backend paths.
5. After that trust boundary, `uok.module_model_registry` imports only validated
   `model_exports` targets in required/dependency/alphabetic order. Each provider
   returns `dict[str, mapped class]`, and its output must exactly match the
   manifest's direct table claims.
6. Registration rejects missing, extra, foreign-origin, unmapped, second-Base,
   duplicate-name, duplicate-table, and hidden mappings. A partially failed
   registration is terminal for the process because SQLAlchemy mappings and
   listeners cannot be rolled back safely.
7. Registration completes before migration inspection or
   `Base.metadata.create_all`. Repeated registration is idempotent and verifies
   that no mapper was added after the immutable snapshot.
8. `uok.models` and the former specialized `src/uok/*_models.py` files remain
   compatibility facades only. They re-export the exact canonical class objects
   and never define or subclass module mappings.
9. Kernel table use is declared as an explicit scope, including
   `ModuleRecord:apps.manager`, `CommandLog:<module>`, and
   `EventRecord:<aggregate>`. Those claims do not move the kernel mappings.
10. This relocation does not change table names, columns, constraints, data, or
    migrations. Future module schema changes remain module-migration owned.

The scheduling boundary is unchanged: Python module service first, with React
UI receiving validated schedule read models.

## Consequences

- Physical source ownership now matches manifest ownership without changing
  database identity or compatibility imports.
- Startup has an explicit sequence: static contract, model registration, other
  extension composition, then schema/bootstrap work.
- A module cannot silently expose a mapped class that it omitted from its
  manifest provider.
- The kernel keeps product-neutral control and audit mappings while modules own
  capability schemas and listeners.
- Direct imports from `uok.models` remain supported for existing callers, but
  new module implementation code should import its own `.models` provider.

## Alternatives Considered

- **Keep all mappings in `src/uok`.** Rejected because declared ownership would
  remain descriptive rather than physical.
- **Give every module a declarative Base.** Rejected because cross-table foreign
  keys, migration inspection, sessions, and `create_all` require one metadata
  graph.
- **Import module providers during static validation.** Rejected because it
  would execute extension packages before the validated manifest boundary.
- **Duplicate or subclass compatibility mappings.** Rejected because separate
  mapper identities can diverge and duplicate tables in the same metadata.
- **Add a schema migration.** Rejected because source relocation makes no
  relational change.

## Validation

- The checked-in registry fixture proves the exact 9 kernel and 29 module model
  names and table names.
- Identity tests prove every compatibility alias is the owning module's exact
  class object on the single `Base.metadata`.
- Import-order subprocesses cover `uok.models`, module providers, migration
  inspection, and module table inspection as first imports.
- Registry tests prove deterministic provider order, idempotence, complete
  manifest ownership, backend source origins, and all 38 SQLite `create_all`
  tables.
- Existing module, migration, PostgreSQL candidate, and full sequential test
  gates prove unchanged behavior and schema compatibility.

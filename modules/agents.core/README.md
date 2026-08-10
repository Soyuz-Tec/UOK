# agents.core

**Status:** Installable `integration_tested` backend governance foundation.

**Current candidate:** `UOK-3.1.0-alpha.3`

`agents.core` owns UOK's domain-neutral runbooks, generated plan DAGs, deterministic approval policy, human decisions, recovery proposals, and hash-addressed evidence.

The module recognizes `codex` as a governed tool-binding identifier but does not call Codex, another external tool, or a target-module command in this increment. Business records and command authority remain with the target module.

See `docs/architecture/ADR-0031-governed-agent-runbooks-plans-and-evidence.md` and `docs/modules/agents.core/AGENTS_CORE_MODULE_PLAN.md`.

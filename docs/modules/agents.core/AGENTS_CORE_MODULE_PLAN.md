# Agents Core Module Plan

**Status:** Integration-tested backend governance foundation; runtime proof, UI, and executors remain.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Module:** `agents.core`

## Purpose

`agents.core` provides UOK's reusable, domain-neutral governance envelope for agent runbooks, generated process plans, approval gates, recovery proposals, decisions, and compliance evidence.

Business modules continue to own domain records, commands, permissions, and approval meaning. Codex is recognized as a governed tool-binding identifier, not as an uncontrolled authority. The current increment does not call Codex or dispatch a generated business command.

## Implemented Backend Foundation

- installable `integration_tested` module lifecycle;
- tenant-scoped runbook catalog and versioning;
- one installed target-module scope per runbook;
- validation against target manifest commands and permissions;
- bounded `codex` tool-binding declaration;
- low/medium/high/critical risk classification;
- `always` and `risk_based` approval policies;
- run input snapshots and immutable runbook-scope snapshots;
- bounded initial, revision, and recovery plan DAGs;
- analysis, tool, command, and human plan steps;
- dependency-cycle, module, tool, command, data-scope, impact, and size validation;
- deterministic approval reasons;
- approve, reject, request-revision, escalate, and separate override decisions;
- approved completion and explicit failure/recovery lifecycle;
- tenant-scoped input, plan, decision, override, outcome, and failure evidence;
- canonical JSON SHA-256 evidence and plan digests;
- UOK command-log and module-event correlation;
- read API for runbooks, runs, approval queue, decisions, and evidence.

## Permissions

| Permission | Purpose |
|---|---|
| `agents.read` | Read runbooks and run state. |
| `agents.run` | Start runs, submit plans, record completion, and record failure. |
| `agents.manage` | Create, update, and archive runbooks. |
| `agents.approve` | Approve, reject, request revision, or escalate gated plans. |
| `agents.audit` | Read decision history and evidence content. |
| `agents.override` | Override a gated/rejected policy outcome with an accountable reason; only wildcard administrators currently receive it. |

## Deliberate Safety Boundary

- No autonomous financial commitment, purge, external submission, legal acceptance, or policy exception.
- No direct database writes to business-module tables.
- No unmanaged Codex or external-tool execution.
- No target-module command dispatch from a generated plan.
- No product-specific agent behavior inside `agents.core`.
- No background scheduler or hidden retry loop.
- No executable Agents frontend surface yet.

Low-risk informational plans may become policy-approved when a runbook uses `risk_based` approval. Every business-command proposal and every protected impact still requires a human decision. A recovery plan re-enters the same validation and approval path.

## Next Increments

1. Add a module-owned Agents workbench with runbook catalog, approval tray, evidence timeline, policy badges, and decision panel using shared UOK primitives.
2. Add a module-owned candidate verifier and PostgreSQL runtime proof for lifecycle, permissions, tenant isolation, approval, override, disabled-module behavior, and evidence hashes.
3. Define a separate executor ADR for Codex authentication, secret storage, egress, data minimization, prompt/output retention, output validation, timeouts, retries, rate limits, cancellation, tool receipts, and deterministic fallback.
4. Correlate an approved plan step to an actual idempotent UOK target-module command receipt without bypassing the target actor's permission.
5. Pilot a domain-owned runbook, initially analysis/proposal only, before allowing any low-risk executor path.

## Acceptance Criteria For Runtime-Proven Maturity

- Backend behavior passes module, architecture, security, tenant, and lifecycle tests.
- PostgreSQL migration and runtime smoke pass against the packaged candidate.
- Candidate verifier proves unauthorized, undeclared, cross-tenant, unapproved, and disabled-module actions fail closed.
- Workbench approval and evidence paths pass TypeScript, accessibility, build, browser, and console-clean proof.
- Every future tool call stores identity, scope, request/output evidence, status, timing, and correlation.
- Every future target command uses the existing UOK command bus, target permission, idempotency, and module-operational gates.
- AI unavailability degrades to a human-managed workflow.
- No readiness statement implies unsupervised or production-ready autonomy.

# ADR-0031: Governed Agent Runbooks, Generated Plans, And Evidence

**Status:** Accepted for the `agents.core` backend foundation.

**Date:** 2026-08-09

## Context

UOK needs to support AI-era business operations without allowing an LLM or external tool to become a second command bus, permission system, workflow authority, or system of record. The existing target architecture assigned generic agent governance to `agents.core`, domain behavior to business modules, and enforcement to existing UOK permissions and module lifecycle controls. Before this decision, `agents.core` was an inert `planned` scaffold.

The first executable increment must support generative process design and recovery planning while failing closed around business mutations, destructive actions, external submissions, financial commitments, legal acceptance, and policy exceptions. It must also preserve tenant isolation and human-readable, integrity-verifiable evidence.

## Decision

UOK will implement the first agent-governance increment as a module-owned backend capability under `modules/agents.core`.

### Runbooks are guardrails, not prompt blobs

An agent runbook declares:

- a goal and target installed module;
- allowed governed tool bindings;
- allowed target-module commands;
- allowed target-module permission/data scopes;
- a risk level; and
- an `always` or `risk_based` approval policy.

Runbook validation resolves only the closed module catalog. Undeclared modules, tools, commands, or data scopes fail before a runbook can be stored. A runbook cannot target `agents.core` recursively.

### Generated processes are validated DAGs

Each run may submit an `initial`, `revision`, or `recovery` plan. A plan is a bounded directed acyclic graph of `analysis`, `tool`, `command`, and `human` steps. Every step declares dependencies, impact, module scope, tool or command identity where applicable, and data scopes.

The deterministic policy layer rejects cycles, missing dependencies, undeclared scopes, undeclared tools, undeclared commands, cross-module targets, malformed step contracts, and plans above the evidence-size budget.

### Approval is deterministic and fail-closed

Human approval is required when any of these conditions is true:

- the runbook policy is `always`;
- runbook risk is above `low`;
- a plan contains a protected impact; or
- a plan proposes a UOK business command.

Only low-risk, informational plans under `risk_based` policy can become policy-approved without a human decision. Approval does not execute a target-module command in this increment.

Approve, reject, request-revision, and escalate decisions require `agents.approve`. Policy override is a separate `OverrideAgentRun` command requiring `agents.override`; the module grants no non-administrator role that permission. Every decision requires a reason.

### Recovery uses the same policy path

A failed run may submit a `recovery` plan. Recovery plans use the same DAG, tool, command, scope, impact, and approval validation as initial plans. “Self-healing” therefore means governed recovery proposal and re-entry, not an unbounded bypass around controls.

### Evidence is durable and integrity-addressed

`agents.core` owns four private mappings:

- `AgentRunbook`;
- `AgentRun`;
- `AgentApproval`; and
- `AgentEvidence`.

Runs snapshot the runbook version and allowed scope. Input, plan, decision, override, outcome, and failure evidence is stored as canonical JSON with a SHA-256 digest. Command logs and module events retain correlation identities through existing UOK infrastructure.

Evidence and approvals are tenant-scoped. Uninstall disables access but does not delete governance records. Purge or anonymization requires a future explicit policy, migration, authorization model, and audit evidence.

### External execution remains deferred

The manifest recognizes `codex` as the only supported governed tool-binding identifier in this increment, but UOK does not call Codex, an LLM API, or another external tool. It also does not dispatch generated target-module commands. Those adapters require a later decision covering credentials, egress, prompt/data minimization, output validation, timeout and retry semantics, rate limits, tool identity, command authorization, observability, and deterministic fallback.

The module advances to `integration_tested`, not `runtime_proven`. It declares no candidate verifier and no executable frontend surface yet.

## Consequences

### Positive

- UOK gains an executable agent-governance foundation without changing the Kernel or adding another framework.
- Generated workflows and recovery plans are flexible but machine-validated.
- High-impact proposals cannot silently become business mutations.
- Runbook versions, plan digests, decisions, and outcomes are reviewable as a single evidence trail.
- Domain records and commands remain owned by their business modules.

### Costs and limitations

- This increment does not provide live LLM inference, background scheduling, target-command dispatch, or a workbench UI.
- Completion records an approved outcome; it does not prove a future external executor performed a target command. A later executor must correlate actual UOK command receipts.
- Evidence retention is append-only by policy, so future privacy-safe purge/anonymization needs explicit design.
- PostgreSQL runtime proof and a module-owned candidate verifier remain required before `runtime_proven` maturity.

## Alternatives Considered

### Let an LLM call UOK APIs directly

Rejected. It would create an unmanaged authority path around manifest scope, command permissions, approval policy, idempotency, and audit evidence.

### Put orchestration in `src/uok`

Rejected. Agent governance is an optional capability with its own data, lifecycle, permissions, APIs, and future UI; embedding it in the product-neutral Kernel would violate the architecture freeze.

### Store free-form prompts and plans only

Rejected. Prompt-only rules are not reliably auditable or enforceable. Runbooks and plans require typed, bounded, validated contracts.

### Adopt an external multi-agent framework now

Deferred. UOK first needs a stable governance envelope. An external framework may later sit behind a governed adapter, but it cannot own UOK permissions, data, commands, or approval state.

## Validation

The accepted increment must preserve:

- module release-contract validation;
- module-owned domain, lifecycle, policy, and tenant-isolation tests;
- command idempotency and permission enforcement;
- Host import allowlist and module public-boundary tests;
- naming, source-size, dependency, and architecture gates;
- generated OpenAPI/client contract checks; and
- candidate/runtime proof before any later `runtime_proven` claim.

## Rollback

Disable or uninstall `agents.core` through Apps Manager to remove runtime access while retaining governance records. Reverting the module manifest and source before production data exists returns the module to its former inert scaffold. After durable records exist, rollback must preserve the four owned tables and must not discard approval or evidence history.

# UOK AI Operations Kernel Architecture

**Status:** Active architecture; first backend governance increment is `integration_tested`.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Applies to:** AI agent programming, runbooks, approvals, human decision gates, compliance evidence, agent audit trails, and future AI-enabled UOK modules.

## Purpose

UOK is evolving into a future-focused business management platform where users can program agents to perform repeatable business operations while humans retain control over critical decisions, compliance, approvals, and accountability.

This architecture keeps the kernel product-neutral. AI behavior must be delivered through installable modules and declared extension points, not hardcoded into `src/uok`.

## Core Principle

Agents may prepare, classify, enrich, draft, reconcile, validate, route, summarize, and recommend. Humans approve, reject, override, sign, release, purge, and accept regulated or high-impact outcomes unless an explicit policy authorizes automation for a low-risk action.

## Containers And Ownership

| Area | Owner | Responsibility |
|---|---|---|
| Kernel runtime | `src/uok` | Module composition, authentication, authorization, command bus, evidence APIs, event records, and policy enforcement primitives |
| Agent governance module | `modules/agents.core` | Agent catalog, runbook definitions, approval gates, execution evidence, agent audit, and human handoff workflows |
| Agent tools | Governed external or local tools | Codex and future tools may assist with analysis, drafting, code-aware operations, evidence preparation, and workflow execution only through UOK-approved runbooks and permissions |
| Business modules | `modules/<module-name>` | Domain-specific tools, records, policies, permissions, and approval requirements used by agents |
| Frontend shell | `web/src` | Shared workspace primitives for agent setup, task queues, approval trays, evidence views, and human override UX |
| Database | `agents.core` mappings and migration | Durable runbooks, version-snapshotted runs, approvals, generated plans, and hash-addressed evidence |

## Agent Operating Model

1. User defines an agent runbook.
   - Scope: module, record type, task, data access, allowed tools, risk level, and approval policy.
   - Examples: enrich contacts, prepare follow-up notes, detect duplicate records, draft transaction checklists, reconcile imported documents.

2. UOK validates the runbook.
   - The runbook must reference installed modules, declared permissions, declared commands, and allowed data scopes.
   - The system blocks undeclared tools, hidden data access, and module-boundary violations.
   - Codex tool use must be declared as a governed tool binding with an allowed task scope, evidence retention rule, and human approval policy.

3. Agent operates within a controlled work unit.
   - Every action has an actor, run id, module scope, input evidence, output evidence, and decision state.
   - The agent can propose commands but cannot bypass command permissions or approval gates.
   - The current backend foundation validates and records plans but does not execute Codex, another tool, or a target-module command.

4. Human decision gates control high-impact steps.
   - Approval gates are mandatory for regulated decisions, external submissions, destructive actions, financial commitments, compliance acceptance, record purges, and policy exceptions.
   - Humans can approve, reject, request revision, escalate, or override with reason.

5. UOK records evidence.
   - Store runbook version, data sources, tool calls, generated recommendations, human decisions, timestamps, and final command outcomes.
   - Evidence must be reviewable without reading raw logs first.

## Required Agent Safety Controls

- Permission-bound tool access.
- Module-bound data access.
- Human approval gates by risk level.
- Explicit audit events for every proposed and executed action.
- Replayable evidence for important runs.
- No hidden prompt-only business rules; durable policy belongs in code, manifest, or Markdown.
- No direct Codex or external-tool execution path may bypass UOK permissions, module lifecycle, approval gates, or audit evidence.
- No direct autonomous purge, release, payment, legal acceptance, or external submission without an explicit policy and approval model.
- Privacy-aware redaction for sensitive evidence surfaces.
- Deterministic fallback path when AI service access is unavailable.

## Module Boundary Rules

- `agents.core` owns generic agent programming and governance.
- Codex is a primary governed agent tool for UOK, but it is not the authority for permissions, compliance decisions, data ownership, or final business actions.
- Business modules own domain tools and domain-specific approval policies.
- The kernel owns enforcement primitives and command dispatch only.
- Agent-specific data tables must be module-owned by `agents.core`.
- Business records remain owned by their business modules.
- Generated suggestions are not the source of truth until accepted through a command or human approval.

## Initial Implementation Sequence

1. Completed: catalog scaffold and architecture/module ownership.
2. Completed: four-table durable model for runbooks, runs, approvals, and evidence.
3. Completed: manifest-declared API, commands, permissions, role grants, migration, and integration tests.
4. Completed: generated plan DAG validation, deterministic approval policy, separate override permission, recovery-plan re-entry, and SHA-256 evidence.
5. Next: module-owned workbench for runbooks, approval tray, evidence timeline, and policy badges.
6. Next: candidate verifier and PostgreSQL runtime proof before `runtime_proven` maturity.
7. Deferred behind a new execution decision: authenticated Codex adapter, actual tool-call receipts, timeout/retry/egress controls, and target-command dispatch.
8. Later pilot: a domain-owned runbook such as Contacts enrichment/duplicate proposals with approval and exact command receipts.

## Current Implemented Boundary

- `agents.core` is installable and lifecycle-managed at `integration_tested` maturity.
- Runbooks reference one installed target module and only its declared commands and permissions.
- The only recognized tool-binding identifier is `codex`; recognition is not execution.
- Plans are bounded `initial`, `revision`, or `recovery` DAGs with typed step kinds, impacts, dependencies, target, tool/command, and data scopes.
- Medium/high/critical risk, `always` policy, protected impacts, and every business-command proposal require human approval.
- Only low-risk informational plans under `risk_based` policy can become policy-approved without a human decision.
- `agents.override` is separate from `agents.approve` and is not granted to non-administrator roles.
- Inputs, plans, decisions, overrides, failures, and outcomes are retained as tenant-scoped canonical JSON with SHA-256 evidence digests.
- No background scheduler, LLM call, external tool invocation, or target-module command executor exists in this increment.

## Acceptance Criteria

The broader AI operations capability is not ready for unsupervised business use until:

- all agent capabilities are module-declared;
- every run has durable evidence;
- high-impact actions require human approval;
- permissions are enforced at command and data boundaries;
- approvals, rejections, overrides, and escalations are audited;
- AI failures degrade to a human-managed workflow;
- tests prove agents cannot bypass module lifecycle, permissions, or approval gates.
- a later executor correlates actual tool calls and UOK command receipts to the approved plan;
- candidate and PostgreSQL runtime evidence advance the module beyond `integration_tested`.

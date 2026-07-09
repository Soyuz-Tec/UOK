# UOK AI Operations Kernel Architecture

**Status:** Active target architecture for AI-operated business workflows.

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
| Database | module-owned migrations | Durable agent definitions, runs, approvals, tool calls, and evidence once implementation begins |

## Agent Operating Model

1. User defines an agent runbook.
   - Scope: module, record type, task, data access, allowed tools, risk level, and approval policy.
   - Examples: enrich contacts, prepare follow-up notes, detect duplicate records, draft transaction checklists, reconcile imported documents.

2. UOK validates the runbook.
   - The runbook must reference installed modules, declared permissions, declared commands, and allowed data scopes.
   - The system blocks undeclared tools, hidden data access, and module-boundary violations.
   - Codex tool use must be declared as a governed tool binding with an allowed task scope, evidence retention rule, and human approval policy.

3. Agent executes within a controlled work unit.
   - Every action has an actor, run id, module scope, input evidence, output evidence, and decision state.
   - The agent can propose commands but cannot bypass command permissions or approval gates.

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

1. Catalog scaffold for `agents.core`.
2. Architecture and module plan for agent governance.
3. Durable data model for agent runbooks, runs, approvals, and tool calls.
4. Backend API and command handlers for runbook lifecycle.
5. Shared frontend primitives for approval trays, evidence timelines, and policy badges.
6. Codex tool binding for supervised operational analysis, drafting, and evidence preparation.
7. Contacts pilot: an agent runbook that proposes contact enrichment and duplicate cleanup while requiring human approval.
8. Candidate verifier scenario proving that unauthorized autonomous actions are blocked.

## Acceptance Criteria

The AI operations kernel is not ready for business use until:

- all agent capabilities are module-declared;
- every run has durable evidence;
- high-impact actions require human approval;
- permissions are enforced at command and data boundaries;
- approvals, rejections, overrides, and escalations are audited;
- AI failures degrade to a human-managed workflow;
- tests prove agents cannot bypass module lifecycle, permissions, or approval gates.

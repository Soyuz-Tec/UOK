# Agents Core Module Plan

**Status:** Planned installable capability module scaffold.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Module:** `agents.core`

## Purpose

`agents.core` will provide UOK's reusable agent governance capability. It will let authorized users define controlled agent runbooks, execute low-risk automation, route high-impact steps to humans, and retain audit evidence for compliance review.

This module must stay domain-neutral. Contacts, cargo, accounting, document, product, and industry-specific agent skills belong in their owning modules and are exposed to `agents.core` only through declared commands, permissions, APIs, and policies.

Codex is a primary governed agent tool for UOK. `agents.core` must treat Codex as a tool binding that can help analyze records, draft actions, prepare evidence, and support code-aware operations, but Codex must not bypass UOK permissions, module lifecycle, human approval gates, or audit evidence.

## Initial Scope

The first implementation should support:

- agent runbook catalog;
- runbook versioning;
- module and permission scope declarations;
- allowed tool and command declarations;
- governed Codex tool binding declarations;
- risk level classification;
- human approval requirements;
- run execution records;
- evidence timeline;
- approval queue;
- reject, revise, approve, override, and escalate decisions;
- Contacts pilot runbook for enrichment and duplicate cleanup suggestions.

## Out Of Scope For The First Implementation

- autonomous financial commitments;
- autonomous record purge;
- autonomous external submission;
- autonomous legal or compliance acceptance;
- hidden direct database writes outside UOK commands;
- unmanaged Codex execution outside UOK runbooks;
- product-specific agent behavior inside `agents.core`;
- custom language runtimes or non-approved frontend stacks.

## Workflow Model

1. Admin creates or imports a runbook.
2. UOK validates module availability, permissions, and declared tools.
3. User starts a run against a record set.
4. Agent produces a recommendation, draft, or command proposal.
5. Low-risk actions can be completed if policy allows.
6. High-risk actions enter the human approval queue.
7. Human approves, rejects, requests revision, escalates, or overrides.
8. UOK records evidence and final command outcomes.

## Required Backend Capabilities

- Pydantic schemas for runbooks, runs, approvals, and evidence.
- Tool-binding schemas for Codex and future governed tools.
- SQLAlchemy models owned by `agents.core`.
- Command handlers for runbook and run lifecycle.
- API routes under `/api/agents`.
- Role grants for agent read, manage, approve, and audit permissions.
- Candidate verifier proving lifecycle, permission, and approval-gate behavior.

## Required UI Capabilities

- Agent runbook list.
- Runbook editor.
- Codex tool policy panel.
- Approval tray.
- Run evidence timeline.
- Policy badges for risk and required approval.
- Human decision panel.
- Shared workspace primitives reused from `web/src/shared`.

## Acceptance Criteria

- `agents.core` is installable, disableable, updatable, and maintainable through Apps Manager.
- No agent action bypasses UOK command permissions.
- Codex tool use is scoped, audited, and tied to a runbook.
- High-impact actions require a human decision.
- Every run stores evidence readable by a human reviewer.
- Contacts pilot proves the module can use another installed module without owning its records.
- Tests cover allowed action, blocked action, approval required, approval accepted, approval rejected, and disabled module behavior.

# Planning Gantt Implementation Traceability

**Status:** Active Gate A evidence map.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Owning decision:** `docs/architecture/ADR-0003-planning-gate-a-stabilization.md`

## Purpose

This artifact distinguishes implemented source from verified behavior and gives
reviewers one place to find the acceptance test and evidence for every Gate A
requirement.

## Evidence states

| State | Required evidence |
|---|---|
| `planned` | Owner and acceptance condition recorded |
| `source_present` | Reviewable source exists |
| `unit_tested` | Focused deterministic test passes |
| `integration_tested` | API/database/module interaction passes |
| `runtime_proven` | Candidate runtime/UI proof is saved |
| `production_ready` | Security, performance, recovery, observability, and release gates pass in a production-like profile |

## Gate A traceability

| ID | Requirement | Initial evidence | Required proof before closure | Status |
|---|---|---|---|---|
| PLA-A-001 | Canonical CPM values | `scheduler.py` contains CPM-like metrics | Independent chain, parallel, merge, lag/lead, calendar, target-date, and cycle fixtures | `source_present` |
| PLA-A-002 | Independent hard-constraint validation | Schedule validation exists | Independent validator rejects injected dependency, calendar, constraint, and resource violations | `planned` |
| PLA-A-003 | Stable REST idempotency | UOK command gateway supports replay | Planning write headers, same-key replay, and changed-payload conflict tests | `source_present` |
| PLA-A-004 | Optimistic concurrency | No project revision contract | Migration, ETag/expected revision, stale-write conflict, and UI recovery proof | `planned` |
| PLA-A-005 | Atomic batch mutation | UI currently runs independent updates | All-or-nothing rollback and one-revision success tests | `planned` |
| PLA-A-006 | Complete immutable baseline | Baseline stores a partial task snapshot | Canonical v2 snapshot, hash verification, immutability, and legacy warning tests | `source_present` |
| PLA-A-007 | Server capability enforcement | `planning.read/manage` exist | Capability matrix and direct adversarial API tests | `source_present` |
| PLA-A-008 | Database invariant enforcement | Initial module migration exists | PostgreSQL 18 apply/readback and invalid-row tests | `source_present` |
| PLA-A-009 | Structured Planning errors | Mixed framework/value errors exist | Stable code, field/object context, repair, revision, and correlation contract | `planned` |
| PLA-A-010 | Typed Planning client | Planning client contains broad unknown payloads | Generated or explicit typed requests, responses, errors, revisions, and capabilities | `source_present` |
| PLA-A-011 | End-to-end audit correlation | Commands and Planning events exist | One user intent correlates command, derived changes, event, audit/outbox, revision, and response | `source_present` |
| PLA-A-012 | Accessible non-drag alternatives | Keyboard and inspector paths exist | Move, resize, progress, dependency, and create flows proven without dragging | `integration_tested` |

## Required reference schedule cases

| Case | Expected evidence |
|---|---|
| Single chain | Correct early/late dates, zero-float critical path |
| Parallel paths | Shorter path receives correct float |
| Merge point | Longest predecessor controls merge date |
| FS, SS, FF, SF | Type-specific precedence holds |
| Positive lag / negative lead | Calendar-aware relation arithmetic is correct |
| Weekend and holiday | Non-working dates are excluded consistently |
| Milestone | Zero duration and equal start/finish |
| Summary | Excluded from CPM graph; dates/progress roll up from descendants |
| Manual task conflict | Dates stay fixed and a violation is returned |
| Target date | Negative float is reported rather than clamped away |
| Dependency cycle | Mutation is rejected and no partial write remains |

## Closure rule

A row may advance only when the evidence is present on the current branch and
the narrow relevant check passes. `production_ready` requires the production
hardening profile and cannot be inferred from local alpha tests.

Before Gate A closes, link this artifact from:

- `docs/DOCUMENTATION_INDEX.md`;
- `docs/ARCHITECTURE.md`;
- `docs/modules/planning.core/PLANNING_CORE_MODULE_PLAN.md`;
- `docs/modules/planning.core/PLANNING_GANTT_FEATURE_CATALOG.md`.


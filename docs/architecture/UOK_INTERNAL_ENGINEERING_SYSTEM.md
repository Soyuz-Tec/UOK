# UOK Internal Engineering System

**Status:** Mandatory active engineering system.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Applies to:** UOK policies, checklists, CI gates, code review rules, release gates, dashboards, audit evidence, local verification, GitHub preparation, and future module development.

## Purpose

UOK uses well-known engineering and assurance standards as reference inputs, then converts them into practical UOK behavior. The goal is not to copy standards as paperwork. The goal is to make quality, security, reviewability, supply-chain integrity, and operational evidence part of daily development.

The working model is:

```text
Microsoft SDL
+ Google Engineering Practices
+ SLSA
+ OpenSSF Scorecard
+ ISO/IEC/IEEE 12207
+ ISO/IEC/IEEE 15288
+ ISO/IEC/IEEE 42010
+ ISO/IEC 25010
+ ISO/IEC 5055
+ ISO/IEC/IEEE 29119
+ NIST SP 800-218 SSDF
+ OWASP ASVS
+ OWASP SAMM
= UOK Internal Engineering System
```

UOK documents should use the well-known standard names above when a rule is derived from them.

## Source Standards And Practices

| Source | What UOK adopts |
|---|---|
| Microsoft Security Development Lifecycle (Microsoft SDL) | Secure lifecycle governance, threat modeling, secure defaults, security testing, monitoring, and response |
| Google Engineering Practices | Code health, code review discipline, small reviewable changes, test evidence, readability, and maintainability |
| SLSA | Build integrity, artifact provenance, source-to-build trust, and supply-chain hardening |
| OpenSSF Scorecard | Automated security-health checks for source, build, dependencies, tests, and project maintenance |
| ISO/IEC/IEEE 12207 | Software lifecycle process discipline |
| ISO/IEC/IEEE 15288 | System lifecycle process discipline |
| ISO/IEC/IEEE 42010 | Architecture description, viewpoints, views, decisions, and architecture evidence |
| ISO/IEC 25010 | Product quality characteristics such as maintainability, reliability, performance, security, usability, compatibility, and portability |
| ISO/IEC 5055 | Automated source-code quality measurement for reliability, security, performance efficiency, and maintainability |
| ISO/IEC/IEEE 29119 | Software testing concepts, processes, documentation, and techniques |
| NIST SP 800-218 SSDF | Secure software development practices integrated into the SDLC |
| OWASP ASVS | Web application security verification requirements |
| OWASP SAMM | Security maturity model across governance, design, implementation, verification, and operations |

## UOK Engineering System Layers

| Layer | UOK implementation |
|---|---|
| Policies | `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/architecture/*`, `docs/design/*`, and `docs/operations/*` |
| Checklists | Pull request template, module acceptance rules, candidate completion definition, GitHub preflight, and release evidence expectations |
| CI gates | Python compile, Python tests, dependency audits, technology audit, engineering evidence, module contract, source-size, source-boundary, naming, frontend tests, static build, and OpenSSF Scorecard |
| Code review rules | Small focused changes, ownership clarity, readable code, tests for behavior, architecture impact stated, no avoidable complexity |
| Release gates | Candidate verifier, module verifier scripts, migration checks, dependency audits, build output, local runtime health, backup/restore confidence where relevant |
| Dashboards | Current implementation uses CI results, local audit JSON, generated quality scorecard, module evidence, candidate verifier output, and future UI status surfaces |
| Audit evidence | CI logs, local audit output, generated engineering evidence, generated quality scorecard, verifier output, PR review records, release notes, ASUH events, and local runtime smoke evidence |

## Mandatory Development Flow

Every non-trivial UOK change follows this flow:

1. Establish authority.
   - Confirm repo root, branch, runtime target, Git state, `AGENTS.md`, architecture docs, affected module docs, and active policies.

2. Classify ownership.
   - Decide whether the work belongs in `src/uok`, `modules/<module_name>`, `web/src/shared`, `web/src/features`, migrations, tests, docs, or operations.

3. Draft the change against the standards.
   - Use Microsoft SDL and NIST SP 800-218 SSDF for security-sensitive work.
   - Use Google Engineering Practices for reviewability, small changes, test evidence, readability, and code health.
   - Use ISO/IEC/IEEE 42010 for architecture descriptions and ADR-level changes.
   - Use ISO/IEC 25010 and ISO/IEC 5055 for maintainability, reliability, performance, security, and source-quality thinking.
   - Use ISO/IEC/IEEE 29119 for testing strategy and evidence.
   - Use SLSA and OpenSSF Scorecard for supply-chain and GitHub hardening.

4. Implement with executable checks.
   - Add or update tests, verifiers, scripts, CI gates, or documentation routes when the change creates a durable rule.

5. Review for UOK fit.
   - Ensure the change is product-neutral where required, module-owned where appropriate, typed, source-size compliant, and aligned with the UI and stack policies.
   - When AI workers are used, apply `docs/architecture/UOK_AI_WORKER_DEVELOPMENT_MODEL.md`; specialist output remains advisory until verified by the coordinator against UOK gates.

6. Verify.
   - Run the narrowest relevant gate during development and the broader gate before handoff or publication.

7. Preserve evidence.
   - Keep local evidence under `var/` unless sanitized and explicitly promoted.
   - Keep durable standards and rules in Markdown, scripts, tests, CI, and PR templates.

## Code Review Rules

Reviewers and authors must check:

- Does the change improve or preserve overall UOK code health?
- Is the change small enough for reliable review?
- Is ownership clear and aligned with module boundaries?
- Are names, types, API contracts, and data flows understandable?
- Are tests or verifier outputs included for behavior changes?
- Are security, privacy, authorization, and auditability preserved?
- Are generated files, local evidence, and runtime artifacts handled correctly?
- Does the PR explain architecture impact, risk, and rollback?

## Release Gate Rules

Before candidate promotion or GitHub publication, UOK must have:

- clean intentional diff;
- passing `TechnologyAudit`;
- passing `Audit`;
- passing `Verify` for candidate-level handoff;
- passing CI on GitHub when published;
- GitHub guardrails in place through CODEOWNERS, Dependabot, PR template, Copilot instructions, and OpenSSF Scorecard workflow;
- source-boundary and naming gates clean;
- dependency audits clean;
- module contract clean;
- frontend build and generated API client current;
- local runtime smoke evidence when runtime behavior changed;
- backup/restore or ASUH evidence when operations behavior changed.

## Dashboard And Evidence Direction

UOK should progressively expose the engineering system through dashboards:

- CI status and latest verification result;
- generated quality scorecard result;
- module installation and health status;
- source-boundary and naming status;
- dependency audit status;
- OpenSSF Scorecard status;
- candidate verifier status;
- backup/restore and ASUH drill status;
- module-level test and evidence status.

Until a dedicated dashboard exists, command output, generated engineering evidence, generated quality scorecards, and CI logs are the audit evidence source.

## No Certification Claim

This document maps UOK practice to well-known standards and industry practices. It does not claim formal ISO, NIST, OWASP, Microsoft, Google, SLSA, OpenSSF, or CMMI certification.

Formal certification would require separate scope definition, evidence retention, independent audit, and organizational controls beyond this local development standard.

## Validation

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Audit
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action EngineeringEvidence
```

For candidate-level work, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```

# UOK Code Quality And Technology Audit Standard

**Status:** Mandatory active standard.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Applies to:** source organization, line-of-code integrity, dependency discipline, runtime stack alignment, technology choices, reviewability, tests, GitHub readiness, and local candidate verification.

## Purpose

UOK development must stay easy to review, test, extend, and operate as modules grow. This standard turns quality lessons into enforceable rules so future work does not create avoidable rewrites, hidden technical debt, or slow expansion.

This standard implements the quality and technology-audit layer of the broader `docs/architecture/UOK_INTERNAL_ENGINEERING_SYSTEM.md`, which maps UOK practice to Microsoft SDL, Google Engineering Practices, SLSA, OpenSSF Scorecard, ISO/IEC/IEEE 12207, ISO/IEC/IEEE 15288, ISO/IEC/IEEE 42010, ISO/IEC 25010, ISO/IEC 5055, ISO/IEC/IEEE 29119, NIST SP 800-218 SSDF, OWASP ASVS, and OWASP SAMM.

The executable audit entry point is:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
```

## Quality Principles

1. Keep one clear owner for every change.
   - Runtime composition and shared infrastructure belong in `src/uok`.
   - Business or capability behavior belongs in `modules/<module_name>`.
   - Product-neutral shell, composition, generated contracts, and shared UI primitives belong in `web/src`.
   - Module-specific production UI and CSS belong in `modules/<module_name>/web/src`; module frontend tests belong in `modules/<module_name>/tests/web`.

2. Keep files reviewable.
   - Split before a file carries unrelated responsibilities.
   - Prefer focused components, hooks, command handlers, read models, policy modules, and tests.
   - Generated files and lockfiles are exempt from manual splitting, but must not be edited by hand.

3. Keep the stack narrow.
   - Backend work uses Python, FastAPI, Pydantic, SQLAlchemy, and PostgreSQL.
   - Frontend work uses TypeScript, React, Vite, generated API types, and CSS design tokens.
   - Podman-compatible local packaging uses Python 3.14, Node 26, and PostgreSQL 18.
   - New durable languages, frameworks, ORMs, package managers, or UI systems require an ADR and policy update before implementation.

4. Keep quality executable.
   - A rule that can be checked should become a script, test, CI step, or candidate verifier.
   - A repeated manual review comment should become a shared component, reusable service, policy, or verifier.

5. Keep evidence current.
   - Documentation must reflect current behavior.
   - Current tests, CI, manifests, and live runtime checks are stronger than older notes.
   - Local evidence under `var/` stays out of Git unless sanitized and explicitly promoted.

## Line-Of-Code Integrity

Physical line count is a maintainability and reviewability signal. It is not a
complexity measure, benchmark, latency measurement, memory profile, or proof
of runtime performance. No cited industry standard defines a universal
`200`-, `250`-, or `300`-line rule:

- [NIST SP 800-218 SSDF](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-218.pdf)
  requires organizations to define and automate review and analysis practices;
- [ISO/IEC 5055](https://www.iso.org/standard/80623.html) defines automated
  measurement of structural and coding-practice violations;
- [Google Engineering Practices](https://google.github.io/eng-practices/review/developer/small-cls.html)
  explicitly treats change size as contextual rather than a fixed line count;
  and
- Ruff's
  [too-many-statements](https://docs.astral.sh/ruff/rules/too-many-statements/)
  and [McCabe complexity](https://docs.astral.sh/ruff/settings/#lintmccabe)
  rules are complexity signals, not physical-line standards.

UOK therefore adopts the following repository-specific heuristics:

| Source class | Soft review threshold | Hard gate |
|---|---:|---:|
| Files named for route, API, or command families; Python files in API/router directories; React components/hooks; and test files | `200` physical lines | `300` physical lines |
| Other handwritten Python, TypeScript, CSS, PowerShell, and SQL | `250` physical lines | `300` physical lines |
| Production/tooling Python functions | `60` physical lines | `120` physical lines |

The focused-file classification is deliberately path- and name-based rather
than inferred from source semantics. Python filenames are tokenized across
separators and camel-case boundaries for exact route, API, and command-family
tokens; Python files beneath exact `api`, `apis`, `route`, `routes`, `router`,
or `routers` directory parts are also focused. TypeScript filenames use the
same tokenization for route/API families, including names such as
`shipmentApi.ts`, while React components, hooks, and tests retain their
dedicated path/type rules. Substrings such as `capital` do not match `api`.

Test functions and module candidate-verifier functions are exempt from the
function thresholds because scenario setup is often clearest as one auditable
flow. Their files remain subject to the normal soft and hard file thresholds.
Migrations are never exempt from the file caps. Generated, compiled, lock, and
vendor content is excluded only by the exact path and type rules in
`scripts/source_size_policy.py`; a symlink encountered in a scanned source
root is rejected instead of followed or silently excluded.

The authoritative command is:

```powershell
python scripts/source_size_policy.py
```

The default command prints a concise operator summary. Add `--json` to emit
the complete `uok.source_size_report.v1` JSON report. Both modes fail on any
unapproved hard-cap breach, new soft-warning identity, or growth above an
accepted soft baseline. `config/source_size_policy.json` stores the
review-debt ratchet using stable `file:<path>` and
`function:<path>::<qualified-symbol>` identities.
Unchanged or reduced baseline debt passes. A fully resolved warning produces
`baseline_update_required` until its obsolete entry is removed, preventing the
configuration from accumulating stale allowances. Generate a candidate
configuration for review without modifying the repository with:

```powershell
python scripts/source_size_policy.py --print-baseline
```

Baseline regeneration is not a routine escape hatch. A normal update may only
lower or remove accepted maxima. Adding or increasing baseline debt requires
an explicit reviewed reset in the pull request, with the affected owner and
follow-up recorded.

A hard violation cannot be suppressed by prose. A future exception must be a
bounded entry in `config/source_size_policy.json` that identifies exactly one
file or qualified Python symbol and records its kind, exact path/symbol,
owner, reason, tracking issue, expiry date, and elevated maximum. Wildcards,
expired entries, unused entries, incomplete entries, and exceptions that do
not match the finding fail closed. Exceptions do not remove the finding from
evidence; they make only the explicitly bounded excess non-blocking until
expiry.

The scan covers handwritten `.py`, `.ts`, `.tsx`, `.css`, `.ps1`, and `.sql`
files under `src`, `modules`, `web`, `tests`, `scripts`, `migrations`, and
`deploy`, plus root `conftest.py`.
The complete report, including hard-cap, active-exception, soft-warning, and
ratchet counts, is retained in `EngineeringEvidence`. Hard violations and
ratchet regressions fail `TechnologyAudit`, `Audit`, `Verify`, and hosted CI.
Existing accepted soft debt remains visible and must not grow.

## Technology Audit Rules

The technology audit must confirm:

- required architecture, policy, operations, and GitHub artifacts exist;
- the UOK Internal Engineering System is documented, linked, and populated with the well-known standard names it adopts;
- Python version policy remains `>=3.14`;
- runtime and development Python dependencies are pinned, separated, and exactly aligned with the corresponding `pyproject.toml` dependency groups;
- TypeScript `strict` remains enabled and `allowJs` remains disabled;
- durable frontend JavaScript is not added under `web/src` or `modules/*/web/src`;
- `web/package-lock.json` is present;
- direct frontend runtime dependencies and the governed lint toolchain use approved exact versions, the lockfile root matches the manifest, and critical runtime packages resolve once;
- ESLint covers shell, shared, module production, tests, end-to-end tests, configs, and frontend scripts with React Hooks correctness enforced;
- Stylelint covers shell and module CSS, rejects hexadecimal colors outside `web/src/design-tokens.css`, the configured physical left/right property list, `text-align: left|right`, unjustified `!important`, and ID selectors;
- the built frontend stays within reviewed raw and gzip JavaScript/CSS budgets, and CI runs the budget check only after the production build;
- Dockerfile, local compose, and CI stay aligned with Python 3.14, Node 26, and PostgreSQL 18;
- container stages install runtime Python requirements only;
- the repository wires a non-mutating OpenAPI JSON and generated TypeScript declaration drift check; the broader `Audit` gate executes it and requires exact runtime-schema parity;
- every module manifest has `backend`, `web`, `migrations`, and `tests` folders;
- local evidence under `var/` remains ignored;
- this standard is linked from the documentation index and operations runbook.
- active documentation repository references, internal links, and index coverage resolve with exact path casing and contain no retired frontend locations.
- the source-size configuration is schema-valid, exact, non-expired, and
  consistent with the current handwritten-source inventory;
- engineering evidence includes a repeatable repository-conformance scorecard.

## Frontend Quality Gates

Frontend changes must run the platform gates in dependency order:

```powershell
npm --prefix web ci
npm --prefix web run check:contracts
npm --prefix web audit --audit-level=low
npm --prefix web run check:dependencies
npm --prefix web run lint
npm --prefix web run lint:styles
npm --prefix web test
npm --prefix web run test:accessibility
npm --prefix web run build:static
npm --prefix web run check:bundle-budget
```

`check:dependencies` is the direct-manifest and lockfile authority. `lint` and
`lint:styles` are correctness gates rather than formatting suggestions.
`check:bundle-budget` measures every emitted JavaScript and CSS asset in raw and
gzip form and fails closed when assets are missing or exceed the reviewed
ceiling. Current ceilings are owned by
`docs/design/UOK_WORKSPACE_UI_IMPLEMENTATION_STANDARD.md`.

The canonical maturity assessment, reuse inventory, and sequenced remediation
work are owned by
`docs/architecture/UOK_FRONTEND_PLATFORM_AUDIT_AND_MODERNIZATION_PLAN.md`.

## Quality Scorecard

`EngineeringEvidence` must generate a structured scorecard after each meaningful build or feature. The scorecard converts the executable audit results into comparable categories:

- correctness;
- test coverage;
- split quality;
- reuse and boundaries;
- module discipline;
- UI consistency;
- runtime efficiency;
- security and supply chain;
- documentation;
- CI and release readiness.

The scorecard is a **repository-conformance scorecard**, not an engineering-maturity, security-assurance, test-coverage, certification, or production-readiness rating. The backward-compatible `overall_score` and `grade` fields alias `repository_conformance.score` and `repository_conformance.grade`; consumers must also read its evidence-completeness status.

Repository audit checks may score categories whose rules are directly executable from the checkout. These categories must not receive presence-only credit:

- `test_coverage` requires machine-readable line and branch coverage evidence;
- `security_and_supply_chain` requires a current attributed scanner, provenance, dependency, and control assessment;
- `ci_and_release_readiness` requires current hosted-CI and immutable-release evidence.
- `runtime_efficiency` requires current benchmark, latency, and resource-use
  evidence at a declared workload and environment; source size cannot score it.

When that evidence is not supplied, the category is `unavailable`, its score is `null`, it is excluded from the repository-conformance average, and the scorecard reports partial evidence completeness. Unavailable never means passing. A test file, scanner workflow, release workflow, or guardrail file proves only that a control exists; it does not prove coverage, security, execution, or release readiness.

Optional coverage input uses the fail-closed
`uok.engineering_measurements.v2` schema. The only registered local method is
`coverage_combined_v2`; it verifies the current clean Git HEAD, unchanged
per-lane producer provenance, timezone-aware observation time, exact
non-symlink coverage artifacts, SHA-256 and byte metadata, run-bound
producer output, a full checkout without hidden index flags, exact tracked
Python/frontend inventories, and file-by-file JSON-to-XML/LCOV line and branch
corroboration. A caller cannot supply a score. This is local trusted-runner
reproducibility and integrity evidence, not independent or tamper-proof
attestation. The required GitHub Actions result and retained artifacts for the
exact reviewed commit are the authoritative shared execution record. Build
and consume the verified local input with:

```powershell
python scripts/build_engineering_measurements.py
python scripts/engineering_evidence.py --measurements <measurement-json> --stdout
```

Security/supply-chain and hosted CI/release categories remain unavailable to
this local coverage method. Runtime efficiency also remains unavailable until a
registered measurement method verifies benchmark, latency, and resource-use
evidence. Static repository-control categories are capped below 100 even when
every presence check passes. See
`docs/governance/UOK_ENGINEERING_EVIDENCE_V2_MIGRATION.md` for the producer,
consumer, and retired-v1 migration contract.

`EngineeringEvidence` also retains the complete `source_size_policy` report,
including its schema, scan count, hard-cap and active-exception counts, soft
findings, and no-growth ratchet status. The scorecard remains a review aid and
is not a replacement for `Verify`.

## Efficiency Rules

- Prefer typed contracts and generated API types over hand-maintained duplicated shapes.
- Prefer shared module-neutral UI primitives over copied controls.
- Prefer database-backed filtering, grouping, and search for scalable workflows, with Python orchestration where workflow logic requires it.
- Keep expensive operations behind explicit user actions, paginated APIs, or indexed database queries.
- Avoid loading full datasets into UI state when a paginated or filtered read model can satisfy the workflow.
- Keep command writes transactional and auditable.

## Redundancy Rules

Treat these as code smells:

- duplicate search/filter/sort state models in one feature;
- repeated modal, popover, inline-edit, or table behavior outside shared components;
- duplicated API response typing instead of generated or shared types;
- copied business rules across routes, facades, and UI;
- module behavior in both `src/uok` and `modules/<module_name>`;
- docs that repeat policy without linking to the owning artifact.

When a reusable behavior appears in a second place, move it to the smallest shared owner before a third copy is created.

## Audit Commands

Technology audit:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
```

Standard audit:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Audit
```

Candidate verification:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```

Engineering scorecard and evidence:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action EngineeringEvidence
```

Focused source-size policy:

```powershell
python scripts/source_size_policy.py
```

GitHub preparation:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action GithubPreflight
```

## Completion Definition

A code-quality or technology-standardization task is complete only when:

- the owning Markdown artifact is updated;
- the executable technology audit passes;
- affected tests or audits pass;
- the change does not introduce source-size, naming, module-boundary, or dependency drift;
- any remaining risk is stated clearly before handoff.

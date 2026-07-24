# Shipment Document Expiry Readiness Slice Delivery – 2026-07-23

**Status:** Qualified and delivery evidence recorded.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Purpose:** Record implementation, verification, runtime, and hosted-delivery
evidence for the bounded Shipment document-expiry readiness slice.

**Scope:** Exact-source changes stacked on Shipment Readiness, local and
runtime qualification, browser proof, pull request, hosted CI, residual risk,
and rollback.

**Design authority:**
`docs/delivery/shipment-document-expiry-readiness-slice-design-2026-07-23.md`

## Delivery Contract

The slice is complete only when the implementation proves all of these
accepted rules:

- every read requires explicit `as_of=YYYY-MM-DD`;
- the v1 evaluation time zone is fixed and echoed as `UTC`;
- the warning horizon is 30 calendar days, inclusive;
- recorded and verified instances are expiry-eligible;
- draft and superseded instances are excluded;
- rejected instances retain the existing independent attention behavior;
- null `expires_on` is informational and does not change the readiness band;
- expired and expiring-soon eligible instances add
  `attention_required`;
- evaluation remains synchronous, deterministic, tenant-authorized, and
  read-only; and
- no prediction, score, persistence, cache, mutation, file/binary access, or
  raw foreign data access is added.

## Expected Owner Contract

`ShipmentReadinessSnapshotDTO` and
`resolve_shipment_readiness_snapshots` remain the only Shipment symbols
consumed by Intelligence.

The frozen owner DTO adds:

- `document_instance_expiry_evaluated`;
- `document_instance_expiry_not_recorded`;
- `document_instance_expired`;
- `document_instance_expiring_soon`; and
- `next_document_expiry_on`.

`document_instance_expiry_evaluated` counts all current recorded/verified
instances, including eligible rows with null expiry. The not-recorded field is
that null-expiry subset. The earliest expiry field is the first eligible
non-null date on or after `as_of`; expired dates are excluded, and it is null
when no current or future eligible expiry remains.

Implementation evidence:

- Exact owner files:
  `readiness_snapshot_read_service.py`, `readiness_snapshot_service.py`,
  `public_api.py`, and focused Shipment owner tests/README updates.
- Facade compatibility: passed. Intelligence still imports only
  `ShipmentReadinessSnapshotDTO` and
  `resolve_shipment_readiness_snapshots`.
- Tenant/authorization: passed focused integration and tenant-isolation tests,
  including fail-closed owner-list behavior.
- Foreign data boundary: passed
  `tests/test_intelligence_shipment_data_boundary.py`; Intelligence adds no
  Shipment ORM, table, raw SQL, file, or binary access.

## Expected Intelligence Contract

The endpoint remains read-only:

```http
GET /api/intelligence/shipment-readiness?as_of=YYYY-MM-DD
```

The list response must echo:

- `as_of`;
- `evaluation_timezone: "UTC"`;
- `expiring_soon_horizon_days: 30`; and
- inclusive `expiring_soon_through`.

The existing three readiness bands remain. The new fixed reasons are:

- `expired_document_present`;
- `expiring_document_present`; and
- informational `document_expiry_not_recorded`.

Implementation evidence:

- Exact Intelligence files: delivery API, expiry policy, readiness derivation,
  schemas, Shipment gateway, candidate verifier, focused tests, and
  module-local READMEs.
- Required-date validation: passed exact date-only API coverage; timestamps,
  numbers, missing values, invalid dates, and overflow values fail closed.
- Boundary-date derivation: passed outside-horizon, inclusive day 30,
  same-day, expired day +1, null expiry, ineligible lifecycle, and
  `date.max` coverage.
- Immutability/determinism: passed repeated-read tests and exact-source
  candidate proof; no persistence, cache, command, event, or mutation path was
  added.

## Expected Workbench Contract

The module-owned workbench shows and sends a visible **As-of date** with the
adjacent **Evaluation timezone: UTC** policy, identifies the inclusive 30-day
horizon, exposes the owner aggregate counts, and renders fixed reasons with
localized, accessible, non-color-only meaning.

Existing read-only search, readiness filters, list/detail selection, safe owner
link, Refresh, keyboard behavior, responsive layout, tenant-session safety, and
module lifecycle behavior must remain.

Implementation evidence:

- Exact frontend files: Shipment Readiness workspace, evaluation control,
  list/detail/table, hook/API/types/display helpers, module CSS, localization,
  and focused read/session/expiry tests.
- Explicit request date: passed API mock assertions and live browser boundary
  changes; an empty control does not issue a readiness request.
- Read-only boundary: no mutation control or foreign endpoint is exposed; the
  only owner navigation is the same-origin Shipment detail link.
- Localization/RTL/keyboard/responsive: passed focused tests, Enter row
  selection, filtered-row proof, and desktop plus 375-by-812 CSS-pixel live
  proof without horizontal overflow.

## Architecture And Data Disposition

This is a bounded capability extension under
`docs/architecture/ADR-0028-host-composition-and-neutral-module-surface-contracts.md`.
It does not require a new ADR because it changes no service, module, Host,
Kernel, persistence, deployment, extension-point, or neutral shell boundary.

The fixed UTC v1 product rule is explicit because UOK currently has no
organization or tenant time-zone setting. Configurable tenant time zones are
deferred to a separate decision and migration as applicable.

Validated unchanged totals and surfaces:

- No new module: passed manifest/catalog/module-folder gates.
- No new table or ORM mapping: passed model-claim and data-boundary gates.
- No SQL migration: passed migration-discipline and generated-contract gates.
- No command or event: passed source review and focused regression coverage.
- No Host/Kernel or shell-contract expansion: passed public-facade,
  Host/Kernel backend, shell, physical-boundary, and startup-boundary tests.

## Verification Record

| Gate | Result |
|---|---|
| Focused Shipment owner expiry tests | Passed within 66 focused backend tests |
| Focused Intelligence domain/API/tenant tests | Passed within 66 focused backend tests |
| Existing Shipment Readiness regression tests | Passed |
| Intelligence-Shipment boundary tests | Passed |
| Public facade, Host/Kernel, shell, manifest, physical, and catalog gates | Passed |
| Python compile and Ruff | Passed |
| Documentation naming and quality audit | Passed |
| Generated OpenAPI/TypeScript/catalog contracts | Passed |
| Full Python suite | Passed: 160 unique test files |
| Full frontend suite and type check | Passed: 134 files / 494 tests |
| Static production build | Passed |
| Playwright UI proof | Passed: 19 tests / 1 expected skip |
| TechnologyAudit | Passed |
| EngineeringEvidence | Passed: score 98 / grade A |
| Exact-source PostgreSQL Rebuild and `/health` | Passed |
| All candidate verifiers | Passed: 12 of 12 |
| Live desktop and 375-CSS-pixel browser proof | Passed |
| Zero browser console warnings/errors | Passed |
| GitHub preflight/readiness | Passed |
| Stacked draft pull request | Open: PR #74 |
| Implementation-head hosted CI | Passed: push and pull-request candidate checks |

### Focused commands

```powershell
python -m pytest -q -p no:cacheprovider modules/intelligence.core/tests --ignore=modules/intelligence.core/tests/web
python -m pytest -q -p no:cacheprovider modules/shipments.core/tests/test_shipment_readiness_snapshot_api.py tests/test_intelligence_shipment_data_boundary.py
python -m pytest -q -p no:cacheprovider tests/test_planning_data_boundary.py tests/test_module_public_api_boundaries.py tests/test_kernel_host_backend_boundaries.py tests/test_kernel_host_shell_boundaries.py
python scripts/quality_audit.py
npm --prefix web run check:contracts
npm --prefix web test
npm --prefix web run build:static
```

### Full qualification commands

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action EngineeringEvidence
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Audit
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Rebuild
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action GithubPreflight
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action GithubReadiness
```

## Exact-Source Runtime Evidence

- Branch: `feature/shipment-document-expiry-readiness-slice`
- Base branch: `feature/shipment-readiness-signals-slice`
- Exact implementation commit:
  `53dc65ff4abbfdb270b899804a51dfbb6e79ea07`
- Exact base commit:
  `5800105a79ef5e8b9420b07c92f192746081d03f`
- Engineering evidence:
  `var/evidence/engineering/uok_engineering_20260724T045549Z.json`
  (local-only, clean head, score 98 / grade A).
- OCI API image digest:
  `8499cea58048e450cea588f55a579e3ec603fbfb4ab158f364e8dd0fab9514cf`
- Database image digest:
  `99d320a6265d9f49e7166e21518b664b9291dc203b9d63416c5875c8e3db7150`
- `/health`: HTTP 200, `status=ok`, `name=UOK`,
  `version=3.1.0-alpha.3`.
- Capacity gate: offline and live policy passed with demand 50, usable
  connections 97, and 47 remaining after declared demand.
- Candidate verifier: all 12 module verifiers passed in catalog order.

The first consolidated `Verify` candidate stage observed an older live API
because a concurrent Codex task rebuilt the shared `uok` Compose project from
the main worktree. The exact source/static stages had already passed. The
conflicting task was identified and serialized; the exact image above was then
rebuilt from this worktree, its source/OpenAPI markers were confirmed, and all
12 candidate verifiers plus the live browser proof passed again. This was an
environment ownership race, not a product-code failure.

## Browser Evidence

The final browser demo must prove, at a minimum:

1. the visible as-of date is sent explicitly;
2. the verified candidate instance expiring `2026-10-21` is outside the
   horizon for `as_of=2026-09-20`;
3. that unchanged instance displays expiring-soon attention on the inclusive
   30th-day boundary `2026-09-21`;
4. it remains expiring soon on its same-day boundary `2026-10-21`;
5. it displays expired attention on `2026-10-22`;
6. the Shipment owner lifecycle/version and instance metadata/lifecycle do not
   change;
7. viewer access remains read-only;
8. no mutation control or foreign endpoint is exposed;
9. desktop and 375-CSS-pixel layouts remain usable; and
10. the browser console has zero errors.

Null expiry and draft/superseded exclusion remain mandatory focused
owner/domain test evidence; the live demo does not require additional
candidate rows solely to repeat those cases.

Evidence:

- Demo Shipment/code:
  `fef5c3b5-6591-40e8-baec-c3d20feadb8a` /
  `RCN-AFRICA-VOC-1784872998047`; eligible verified instance expires
  `2026-10-21`.
- `2026-09-20`: Ready, 0 expired, 0 expiring soon; through
  `2026-10-20`.
- `2026-09-21`: Attention required, 0 expired, 1 expiring soon; inclusive
  through `2026-10-21`; reason `expiring_document_present`.
- `2026-10-21`: Attention required, 0 expired, 1 expiring soon.
- `2026-10-22`: Attention required, 1 expired, 0 expiring soon; reason
  `expired_document_present`.
- Header/instance stability: Shipment stayed `closed`, header version 6;
  document instance stayed version 4. The verifier returned to Ready after
  its controlled boundary checks.
- Desktop/narrow: 1498-CSS-pixel desktop and 375-by-812 narrow view passed;
  narrow document/body width was 360 with no horizontal overflow.
- Keyboard/filter/navigation: exact-code filtering produced one row, Enter
  selected it, and the only owner link remained same-origin at
  `/?view=shipments&shipment_id=fef5c3b5-6591-40e8-baec-c3d20feadb8a`.
- Browser console: zero warnings/errors.

## GitHub Delivery

- Prerequisite Shipment Readiness PR:
  [#73](https://github.com/Soyuz-Tec/UOK/pull/73), final evidence head
  `5800105a79ef5e8b9420b07c92f192746081d03f`
- Stacked document-expiry branch: `feature/shipment-document-expiry-readiness-slice`
- Draft pull request: [#74](https://github.com/Soyuz-Tec/UOK/pull/74)
- Exact implementation head:
  `53dc65ff4abbfdb270b899804a51dfbb6e79ea07`
- Implementation-head candidate checks:
  - [push run 30071059157](https://github.com/Soyuz-Tec/UOK/actions/runs/30071059157)
    / [job 89411838830](https://github.com/Soyuz-Tec/UOK/actions/runs/30071059157/job/89411838830):
    passed.
  - [pull-request run 30071076339](https://github.com/Soyuz-Tec/UOK/actions/runs/30071076339)
    / [job 89411892092](https://github.com/Soyuz-Tec/UOK/actions/runs/30071076339/job/89411892092):
    passed.
- Exact evidence head and its hosted CI will be recorded in PR #74 after this
  delivery record is committed.
- Review disposition: independent final review found no remaining P0/P1
  findings after exact date-only validation and the visible UTC-policy fix.

## Residual Risk

The accepted v1 policy evaluates every tenant in UTC because no persisted
organization/tenant time-zone setting exists. This is explicit and visible,
not an inferred local-time decision. A future configurable tenant policy must
not be added without its own ownership, authorization, compatibility, and
migration review.

Expiry signals are evaluated synchronously through the existing in-process
Shipment facade. Large future tenant volumes may require pagination or an
owner-owned read model, but no persistence or cache is justified by this
bounded slice.

Final residual-risk disposition: accepted for this bounded read-only slice.
UTC remains an explicit visible v1 policy, and measured scale—not prediction—
will determine whether a future owner-owned read model is justified.

## Rollback

Rollback is to disable `intelligence.core` or revert this slice. The extension
owns no data and performs no write, so there is no data migration, backfill,
cache purge, or data rollback. Shipment expiry dates and histories remain
untouched.

Rollback proof: final delivery review confirmed there is no owned state,
migration, cache, command, event, or backfill to reverse.

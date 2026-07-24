# Shipment Document Expiry Readiness Slice Delivery – 2026-07-23

**Status:** Implementation and qualification in progress.

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

- Exact owner files: **Pending final diff**
- Exact facade compatibility result: **Pending verification**
- Tenant/authorization proof: **Pending verification**
- No foreign ORM/table/raw-SQL proof: **Pending verification**

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

- Exact Intelligence files: **Pending final diff**
- Required-date validation: **Pending verification**
- Boundary-date derivation: **Pending verification**
- Immutability and determinism: **Pending verification**

## Expected Workbench Contract

The module-owned workbench must show and send a visible **As of (UTC)** date,
identify the inclusive 30-day horizon, expose the owner aggregate counts, and
render fixed reasons with localized, accessible, non-color-only meaning.

Existing read-only search, readiness filters, list/detail selection, safe owner
link, Refresh, keyboard behavior, responsive layout, tenant-session safety, and
module lifecycle behavior must remain.

Implementation evidence:

- Exact frontend files: **Pending final diff**
- Every request includes explicit `as_of`: **Pending verification**
- No mutation controls or foreign API calls: **Pending verification**
- Localization, RTL, keyboard, and responsive proof: **Pending verification**

## Architecture And Data Disposition

This is a bounded capability extension under
`docs/architecture/ADR-0028-host-composition-and-neutral-module-surface-contracts.md`.
It does not require a new ADR because it changes no service, module, Host,
Kernel, persistence, deployment, extension-point, or neutral shell boundary.

The fixed UTC v1 product rule is explicit because UOK currently has no
organization or tenant time-zone setting. Configurable tenant time zones are
deferred to a separate decision and migration as applicable.

Expected unchanged totals and surfaces:

- No new module: **Pending final contract validation**
- No new table or ORM mapping: **Pending final contract validation**
- No SQL migration: **Pending final contract validation**
- No command or event: **Pending final contract validation**
- No Host/Kernel or shell-contract expansion: **Pending architecture tests**

## Verification Record

| Gate | Result |
|---|---|
| Focused Shipment owner expiry tests | Pending |
| Focused Intelligence domain/API/tenant tests | Pending |
| Existing Shipment Readiness regression tests | Pending |
| Intelligence-Shipment boundary tests | Pending |
| Public facade, Host/Kernel, shell, manifest, physical, and catalog gates | Pending |
| Python compile and Ruff | Pending |
| Documentation naming and quality audit | Pending |
| Generated OpenAPI/TypeScript/catalog contracts | Pending |
| Full Python suite | Pending |
| Full frontend suite and type check | Pending |
| Static production build | Pending |
| TechnologyAudit | Pending |
| EngineeringEvidence | Pending |
| Exact-source PostgreSQL Rebuild and `/health` | Pending |
| All candidate verifiers | Pending |
| Live desktop and 375-CSS-pixel browser proof | Pending |
| Zero browser console errors | Pending |
| GitHub preflight/readiness | Pending |
| Stacked draft pull request | Pending |
| Exact-final-head hosted CI | Pending |

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
- Exact commit: **Pending**
- Engineering evidence: **Pending**
- OCI API image digest: **Pending**
- Database image digest: **Pending**
- `/health` result: **Pending**
- Capacity gate: **Pending**
- Candidate-verifier result: **Pending**

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

- Demo Shipment/code: **Pending**
- Evaluation date: **Pending**
- Exact counts and reasons: **Pending**
- Header lifecycle/version before and after: **Pending**
- Desktop/narrow proof: **Pending**
- Console result: **Pending**

## GitHub Delivery

- Prerequisite Shipment Readiness PR: **Pending final link/head**
- Stacked document-expiry branch: `feature/shipment-document-expiry-readiness-slice`
- Draft pull request: **Pending**
- Exact final head: **Pending**
- Hosted candidate-check run/job: **Pending**
- Review disposition: **Pending**

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

Final residual-risk disposition: **Pending qualification and review**

## Rollback

Rollback is to disable `intelligence.core` or revert this slice. The extension
owns no data and performs no write, so there is no data migration, backfill,
cache purge, or data rollback. Shipment expiry dates and histories remain
untouched.

Rollback proof: **Pending final delivery review**

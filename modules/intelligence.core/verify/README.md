# intelligence.core candidate verification

**Status:** Active module-owned candidate verification.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Purpose:** Prove the bounded Shipment Readiness transition and document-expiry
sequence against a running exact-source candidate.

**Scope:** Read-only Intelligence output plus owner-command setup and teardown;
no Intelligence command, event, table, cache, persistence, prediction, or
mutation is introduced.

`UokCandidateShipmentReadiness.ps1` installs the stateless Intelligence module
after its Shipment dependency, finds the Shipment created by the owner
candidate scenario, and uses explicit UTC `as_of` dates to prove the
deterministic advisory sequence:

1. satisfied Shipment facts outside the reviewed expiry horizon derive `ready`;
2. one new required document in `missing` state derives
   `attention_required`;
3. marking that Shipment-owned requirement `received` derives `ready` again;
4. a verified document expiring on `2026-10-21` is outside the horizon on
   `2026-09-20`, enters `expiring_document_present` on the inclusive 30th-day
   boundary `2026-09-21`, remains expiring soon rather than expired on
   `2026-10-21`, and enters `expired_document_present` on `2026-10-22`;
5. every response echoes the explicit `as_of`, fixed `UTC` evaluation policy,
   30-day horizon, and inclusive through date;
6. the verified document instance and Shipment header lifecycle/version remain
   unchanged by all date-window reads; and
7. disabling `intelligence.core` closes its HTTP surface even when the request
   supplies the required `as_of`.

The verifier selects the document type through the Shipment HTTP surface. It
does not read Shipment, Compliance, or any other module's ORM or tables.
The expiry proof reuses the verified Shipment-owned candidate document instance
and never changes its metadata or lifecycle.

Run through the repository verifier catalog:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify_uok_candidate_isolated.ps1 -ProjectName uok
```

The isolated runner reuses the exact local runtime images in fresh disposable
state and destroys that state after the complete dependency-ordered catalog.
The raw catalog runner rejects persistent targets.

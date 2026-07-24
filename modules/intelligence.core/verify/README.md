# intelligence.core candidate verification

**Status:** Active module-owned candidate verification.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Purpose:** Prove the bounded Shipment Readiness transition sequence against a
running exact-source candidate.

**Scope:** Read-only Intelligence output plus owner-command setup and teardown;
no Intelligence command, event, table, cache, or mutation is introduced.

`UokCandidateShipmentReadiness.ps1` installs the stateless Intelligence module
after its Shipment dependency, finds the Shipment created by the owner
candidate scenario, and proves the deterministic advisory sequence:

1. satisfied Shipment facts derive `ready`;
2. one new required document in `missing` state derives
   `attention_required`;
3. marking that Shipment-owned requirement `received` derives `ready` again;
4. the Shipment header lifecycle and version stay unchanged; and
5. disabling `intelligence.core` closes its HTTP surface.

The verifier selects the document type through the Shipment HTTP surface. It
does not read Shipment, Compliance, or any other module's ORM or tables.

Run through the repository verifier catalog:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify_uok_candidate.ps1 -BaseUrl http://127.0.0.1:18088
```

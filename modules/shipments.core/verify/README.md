# shipments.core candidate verification

`UokCandidateShipmentSupport.ps1` proves dependency installation, owner-facade
reference resolution, tenant-authenticated Shipment create/update/status
lifecycle, history, read-only access, and disabled-module fail-closed behavior
against the rebuilt PostgreSQL candidate.

The literal module-local helpers
`UokCandidateShipmentRequirementTypes.ps1` and
`UokCandidateShipmentRequirements.ps1` add the Shipment-owned
document-requirement proof: active Compliance DTO options, required/optional
link management, informational readiness, authorization,
inactive/unknown-type rejection, retained history, and disabled-module
fail-closed reads.

`UokCandidateShipmentDocumentInstances.ps1` and its literal guard helper add
metadata-only Commercial Invoice evidence: draft/edit/record/verify lifecycle,
explicit linked requirement receipt, idempotent histories, DTO-resolved
Compliance types, authorization and reference rejection, and disabled-module
reads. The proof rejects `storage_key` and never exercises file, binary,
multipart, preview, or object-store behavior.

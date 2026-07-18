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
fail-closed reads. They never exercise file or binary storage.

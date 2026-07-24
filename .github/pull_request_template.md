## Scope

- What changed:
- Why:

## Architecture Impact

- Module boundary impact:
- Data/migration impact:
- API/command/event impact:
- UI policy impact:
- Documentation/discoverability impact:
- UOK Internal Engineering System impact:

## Verification

- [ ] `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit`
- [ ] `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action EngineeringEvidence`
- [ ] `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Audit`
- [ ] `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify`
- [ ] Local Podman rebuild or reason not required:
- [ ] Database backup/restore drill or reason not required:

## Review Rules

- [ ] Ownership and module boundaries are clear.
- [ ] Moved or renamed paths are updated in active documentation and pass the documentation-reference audit.
- [ ] Code is small enough for human review.
- [ ] Tests or verifier evidence cover behavior changes.
- [ ] Engineering evidence includes a quality scorecard with reviewed categories.
- [ ] Security, auditability, and rollback posture are preserved.
- [ ] Local evidence under `var/` is not committed.

## Risk And Rollback

- Main risk:
- Rollback plan:
- Follow-up required:

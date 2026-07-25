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
- [ ] `python scripts/source_size_policy.py`
- [ ] Required hosted exact-HEAD checks and retained evidence passed:
- [ ] Local Podman rebuild or reason not required:
- [ ] Database backup/restore drill or reason not required:

## Review Rules

- [ ] Ownership and module boundaries are clear.
- [ ] Moved or renamed paths are updated in active documentation and pass the documentation-reference audit.
- [ ] Source-size hard caps pass; this change introduces no new or grown soft-warning baseline debt.
- [ ] Any source-size exception names one exact path or symbol, owner, reason, issue, expiry, and elevated maximum.
- [ ] Runtime-performance claims cite benchmark, latency, and resource evidence rather than line count.
- [ ] Tests or verifier evidence cover behavior changes.
- [ ] Engineering evidence reports repository conformance, evidence completeness, and unavailable categories.
- [ ] Any engineering-maturity claim cites hosted exact-commit evidence, not only local `var/` artifacts.
- [ ] Security, auditability, and rollback posture are preserved.
- [ ] Local evidence under `var/` is not committed.

## Risk And Rollback

- Main risk:
- Rollback plan:
- Follow-up required:

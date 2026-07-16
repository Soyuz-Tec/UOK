# communications.core tests

The focused suite verifies organization-scoped K Connect thread creation,
idempotency, audit correlation, role policy, provider disablement, migration
ownership, recoverable Delete/Restore, prior-state preservation, strong
ETag/`If-Match` stale repair, frontend focus and confirmation behavior, and the
Planning resolver integration.

```powershell
python -m pytest .\modules\communications.core\tests .\modules\planning.core\tests\test_planning_communication_links.py -q
npm --prefix web test -- --run ../modules/communications.core/tests/web/CommunicationsWorkspace.test.tsx ../modules/communications.core/tests/web/CommunicationsWorkspace.lifecycle.test.tsx
```

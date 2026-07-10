# communications.core tests

The focused suite verifies organization-scoped K Connect thread creation,
idempotency, audit correlation, role policy, provider disablement, migration
ownership, and the Planning resolver integration.

```powershell
python -m pytest .\modules\communications.core\tests .\modules\planning.core\tests\test_planning_communication_links.py -q
```

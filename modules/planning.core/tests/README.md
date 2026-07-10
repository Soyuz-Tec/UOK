# planning.core tests

Focused pytest suites exercise the SQLite-backed contract and API behavior.
After applying module migrations and rebuilding the persistent local stack, run
the PostgreSQL two-client row-lock proof separately:

```powershell
python .\modules\planning.core\tests\runtime\verify_planning_postgres_concurrency.py --base-url http://127.0.0.1:18088
python .\modules\planning.core\tests\runtime\verify_planning_cpm.py --base-url http://127.0.0.1:18088
```

Planning behavior tests and candidate verifier scenarios live in this module-owned test directory.

Canonical CPM reference schedules, injected-invalid independent-validation
fixtures, and API target/order contracts can be run with:

```powershell
python -m pytest .\modules\planning.core\tests\test_canonical_cpm.py .\modules\planning.core\tests\test_cpm_validation.py .\modules\planning.core\tests\test_planning_cpm_contract.py -q
```

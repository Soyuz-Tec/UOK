# planning.core tests

Focused pytest suites exercise the SQLite-backed contract and API behavior.
After applying module migrations and rebuilding the persistent local stack, run
the PostgreSQL two-client row-lock proof separately:

```powershell
python .\modules\planning.core\tests\runtime\verify_planning_postgres_concurrency.py --base-url http://127.0.0.1:18088
python .\modules\planning.core\tests\runtime\verify_planning_cpm.py --base-url http://127.0.0.1:18088
```

Planning behavior tests and candidate verifier scenarios live in this module-owned test directory.

Canonical CPM and resource-capacity reference schedules, injected-invalid
independent-validation fixtures, status lifecycle, safe history, and API
target/order contracts can be run with:

```powershell
python -m pytest .\modules\planning.core\tests\test_canonical_cpm.py .\modules\planning.core\tests\test_cpm_validation.py .\modules\planning.core\tests\test_planning_cpm_contract.py -q
python -m pytest .\modules\planning.core\tests\test_planning_atomic_batch.py -q
python -m pytest .\modules\planning.core\tests\test_planning_complete_baselines.py -q
python -m pytest .\modules\planning.core\tests\test_planning_capabilities.py -q
python -m pytest .\modules\planning.core\tests\test_planning_database_invariants.py .\modules\planning.core\tests\test_planning_audit_correlation.py -q
python -m pytest .\modules\planning.core\tests\test_planning_structured_errors.py .\modules\planning.core\tests\test_planning_idempotency_contract.py -q
python -m pytest .\modules\planning.core\tests\test_resource_capacity_validation.py .\modules\planning.core\tests\test_planning_status_policy.py -q
python -m pytest .\modules\planning.core\tests\test_planning_links.py -q
python -m pytest .\modules\planning.core\tests\test_planning_date_semantics.py -q
python -m pytest .\modules\planning.core\tests\test_planning_participants.py -q
npm --prefix web test -- --run src/features/planning/planningHistoryExecution.test.ts src/features/planning/usePlanningWorkspaceMutations.test.tsx src/shared/forms/InlineTextEdit.test.tsx
npm --prefix web test -- --run src/features/planning/PlanningOperationLinksPanel.test.tsx src/features/planning/planningApi.test.ts
npm --prefix web test -- --run src/features/planning/PlanningTaskDateFields.test.tsx src/features/planning/planningApi.test.ts
npm --prefix web test -- --run src/features/planning/PlanningParticipantsPanel.test.tsx src/features/planning/planningTimelineModel.test.ts src/features/planning/planningApi.test.ts
npm --prefix web run test:ui-proof
```

The candidate verifier is split into one orchestration script plus module-owned
HTTP and contract helpers so each file stays within the source-size policy:

- `verify/UokCandidatePlanning.ps1`
- `verify/UokCandidatePlanningHttp.ps1`
- `verify/UokCandidatePlanningContracts.ps1`
- `verify/UokCandidatePlanningLinks.ps1`
- `verify/UokCandidatePlanningDates.ps1`
- `verify/UokCandidatePlanningParticipants.ps1`

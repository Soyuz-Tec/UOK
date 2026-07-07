# Contact Business Intelligence Profiles Audit Checklist

**Module:** `contacts.core`

**Feature branch:** `feature/contact-bi-profiles`

**Primary PR:** `#1` — `Add native contact business intelligence profiles`

**Plan document:** `docs/modules/contacts.core/CONTACT_BI_PROFILES_PLAN.md`

**Data-point catalogue:** `docs/modules/contacts.core/CONTACT_BI_REPORT_DATA_POINTS.md`

**Status:** Use this checklist before the PR is moved out of draft and again before merge.

## 1. Audit objective

Verify that UOK's contact business intelligence profile feature is complete, maintainable, permission-safe, privacy-aware, and natively integrated into Contacts without leaking product-specific behavior into the UOK kernel.

The audit must answer five questions:

1. **Does it work?** Profiles can be read, written, rebuilt, searched, rendered, and verified.
2. **Is it native to UOK?** The feature is implemented through module-owned extension points and Contacts UI surfaces.
3. **Is it secure?** Permissions, validation, rate limits for future adapters, and command/event auditing are in place.
4. **Is it privacy-aware?** Data is minimized, sourced, governed, and excludes sensitive categories by default.
5. **Can a future developer extend it safely?** The provider adapter, data-point catalogue, risk-signal model, and normalized-table phases are documented and bounded.

## 2. Evidence to collect

| Evidence | Required artifact |
|---|---|
| Commit range | `git log --oneline origin/main..HEAD` |
| Changed files | `git diff --name-only origin/main...HEAD` |
| Backend compile | output from `python -m compileall -q src modules tests` |
| Python tests | output from `python -m pytest -q` |
| Frontend tests | output from `npm --prefix web test` |
| Frontend build | output from `npm --prefix web run build:static` |
| Candidate verifier | output from `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify_uok_candidate.ps1` |
| Browser QA | screenshots or notes for the Contacts Intelligence pane, empty profile state, and permission failure scenario |
| API QA | request/response samples for profile read, evidence write, rebuild, and permission failure |
| Data catalogue review | sign-off that aliases, contact points, identifiers, ownership/control, fraud, AML/KYC, sanctions, scam-risk, and adverse-media data points have been reviewed for first-release/future-release scope |
| Security/privacy review | completed checklist in sections 5 and 6 |

## 3. Automated verification commands

Run from the repository root.

```powershell
python -m compileall -q src modules tests
python -m pytest -q
npm --prefix web test
npm --prefix web run build:static
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify_uok_candidate.ps1
```

Record:

```text
Date/time:
Commit SHA:
OS/shell:
Python version:
Node/npm version:
Database mode:
Result:
Reviewer:
```

## 4. Architecture audit

| Check | Pass criteria | Evidence |
|---|---|---|
| Module ownership | `contacts.core` owns profile behavior and manifest declarations. | `modules/contacts.core/manifest.yaml` |
| Kernel neutrality | No CRM/enrichment/provider logic is hardcoded in `src/uok` except compatibility facades and API schema re-exports. | `git diff origin/main...HEAD -- src/uok` |
| Runtime extension model | Commands, command permissions, API router, events, and owned surfaces are declared through manifest/module extension points. | manifest + command files |
| Storage decision documented | JSON slices are explicitly first-slice storage with a migration path to module tables. | architecture + plan docs |
| Provider phase isolated | External enrichment is not required for the first PR and is documented as a future adapter phase. | plan doc |
| Data-point scope documented | Peer report data points and future normalized tables are documented separately from the first PR implementation. | `CONTACT_BI_REPORT_DATA_POINTS.md` |

## 5. Security and permissions audit

| Check | Expected result | Evidence |
|---|---|---|
| Profile read requires Contacts access | `contacts.read` or higher can read permitted contacts only. | API tests / manual requests |
| Profile write requires manage access | Viewer cannot write profile, evidence, or rebuild. | verifier + API tests |
| Purged contact protection | Profile mutations fail for purged contacts. | unit/API test |
| Command bus enforcement | Profile write/evidence/rebuild mutations run through `execute_command`. | API + command code review |
| Event evidence | Mutations emit `ContactProfileUpdated`, `ContactProfileEvidenceRecorded`, or `ContactProfileRebuilt`. | event table/query or test |
| Idempotency safety | Existing command bus rules prevent unauthorized replay. | candidate verifier |
| Validation | Pydantic and service bounds reject or cap oversized summaries, lists, source fields, and confidence values. | unit tests |
| Error hygiene | Permission/validation failures do not leak internal stack traces. | API tests |
| No secrets | No provider credentials, tokens, or raw API responses are committed. | secret scan/manual review |
| Restricted data separation | AML/KYC, government IDs, source-of-funds/source-of-wealth, SAR/STR, and sanctions disposition artifacts are not exposed in the general contact profile. | code/data review |

## 6. Privacy and governance audit

| Check | Expected result | Evidence |
|---|---|---|
| Data minimization | Evidence stores normalized facts, not full provider payloads. | `profile_service.py` review + tests |
| Purpose metadata | Profile governance includes `allowed_uses`. | schema review |
| Consent/retention metadata | Governance supports `consent_basis` and `retention_hint`. | schema review |
| Do-not-enrich support | Governance includes `do_not_enrich` before adapter work begins. | schema review |
| Sensitive categories excluded | `sensitive_fields_excluded` defaults to true; docs forbid protected-class/health/biometric/unrelated personal-life data. | schema + plan review |
| Source provenance | Profile source records include provider, source type, capture metadata, confidence, fields, and terms. | schema + evidence API sample |
| Accuracy/freshness | Profile has `updated_at`, confidence, source count, and health scoring. | API sample + UI screenshot |
| Retention behavior | Manifest states profile/evidence retention behavior. | manifest review |
| Human review path | Low-confidence or conflicting facts are documented for future review queue handling. | plan doc |
| Alias/contact-point policy | Multiple aliases, emails, phones, domains, addresses, and identifiers are treated as normal multi-valued evidence, not automatic fraud. | data-point catalogue review |
| Fraud signal policy | Fraud/scam indicators are stored as signals with severity, confidence, evidence, and disposition rather than confirmed accusations unless verified. | data-point catalogue review |

## 7. Backend code audit

| File | Checks |
|---|---|
| `profile_schemas.py` | Field limits, safe defaults, confidence enum, source metadata, governance shape, evidence request shape. |
| `profile_service.py` | Safe JSON loading, no side-effect persistence on summary read, bounded evidence/source lists, deterministic scoring, controlled merge behavior. |
| `commands.py` | Commands require correct permissions, call `touch_party`, emit profile events, reject purged contacts. |
| `api.py` | Routes are operationally gated, permissioned, command-backed for writes, and return controlled errors. |
| `read_model.py` | Summaries/search integrate profile data without leaking evidence rows or non-readable contacts. |
| `api_schemas.py` and facades | Schema imports are stable and avoid deep kernel coupling. |
| `manifest.yaml` | Commands/events/owned data slices are declared. |
| Future normalized tables | Confirm future data-point tables remain module-owned and migration-gated. |

## 8. Frontend code audit

| Check | Expected result |
|---|---|
| Type coverage | `ContactBusinessProfile` and `ContactDetailPane` types support the Intelligence pane. |
| Pane navigation | Detail segmented control includes `intelligence`. |
| Empty state | Contacts with no profile render a clear empty state. |
| Profile summary | Summary/confidence/source count/profile health/completeness/tags/risk flags render correctly. |
| Accessibility | Pane labels, buttons, and controls remain keyboard-accessible. |
| Theme compatibility | Light, dark, and system modes remain usable. |
| No provider assumptions | UI does not imply a provider is configured when enrichment is disabled. |
| No restricted AML/KYC exposure | Restricted compliance details do not appear in general Contacts UI unless separate role-gated UI is implemented. |

## 9. API smoke tests

Use authenticated tokens for an ops user and viewer user. The exact token acquisition depends on the local verification setup.

### 9.1 Read empty profile

```http
GET /api/contacts/{party_id}/profile
Authorization: Bearer <ops-token>
```

Expected:

- `200`
- `profile_type` matches contact type or `unknown`
- `confidence` is `unknown` for a new unverified profile
- no evidence rows are returned by the profile summary endpoint

### 9.2 Record evidence

```http
POST /api/contacts/{party_id}/profile/evidence
Authorization: Bearer <ops-token>
Content-Type: application/json

{
  "source": {
    "provider": "manual-review",
    "source_type": "operator_review",
    "confidence": "high",
    "fields": ["summary", "person.current_title"]
  },
  "normalized_facts": {
    "summary": "Operator verified profile summary.",
    "tags": ["verified"],
    "person": {"current_title": "Operations Lead"}
  },
  "merge_into_profile": true
}
```

Expected:

- `200`
- `evidence_count >= 1`
- returned profile confidence is at least `high`
- returned profile summary reflects normalized facts

### 9.3 Viewer write denial

```http
POST /api/contacts/{party_id}/profile/evidence
Authorization: Bearer <viewer-token>
Content-Type: application/json

{
  "source": {"provider": "manual-review", "confidence": "high"},
  "normalized_facts": {"summary": "should not write"},
  "merge_into_profile": true
}
```

Expected:

- `403`
- no evidence row created
- no profile summary changed

### 9.4 Rebuild profile

```http
POST /api/contacts/{party_id}/profile/rebuild
Authorization: Bearer <ops-token>
Content-Type: application/json

{
  "include_notes": true,
  "include_relationships": true,
  "source": {
    "provider": "uok",
    "source_type": "contact_record_rebuild",
    "confidence": "verified",
    "fields": ["display_name", "attrs_json", "relationships"]
  }
}
```

Expected:

- `200`
- confidence is `verified`
- source count increments or remains capped
- profile health score is present

## 10. Browser QA scenarios

| Scenario | Steps | Expected result |
|---|---|---|
| Empty profile pane | Open contact with no evidence, select Intelligence. | Pane renders without errors and shows a useful empty/no-summary state. |
| Profile with evidence | Record evidence, refresh contact detail, select Intelligence. | Summary, confidence, source count, scores, tags, and risk flags render. |
| Search by profile tag | Add tag through evidence, search contact list for tag. | Matching readable contact appears. |
| Viewer access | Log in as viewer, open readable contact. | Viewer can view profile but cannot mutate it. |
| Archive/restore | Archive and restore profiled contact. | Profile remains visible after restore. |
| Disabled module | Disable/uninstall module if supported locally. | Contacts/profile surfaces are blocked or route to module status handling. |

## 11. Data-point and risk-signal audit scenarios

| Scenario | Expected result |
|---|---|
| Multiple names | Alias, former name, DBA, trade name, and transliteration are modelled as separate evidence-backed facts. |
| Multiple emails/phones | Contact points can store type, active/historical status, first/last seen, source count, confidence, and risk flags. |
| Multiple identifiers | Registry ID, LEI, D-U-N-S, CIK, ticker, tax ID, and provider IDs have type, jurisdiction, source, and sensitivity classification. |
| Ownership graph | Parent/subsidiary/affiliate/officer/director/beneficial owner/control-person relationships are represented as edges with evidence. |
| Sanctions hit | Screening result stores matched fields, list/source, score, disposition, reviewer, and timestamp. |
| Scam signal | BEC, impersonation, fake invoice, payment-method pressure, domain mismatch, and payment-instruction-change signals are stored as reviewable signals, not as unverified conclusions. |
| Restricted KYC | DOB, government ID, source-of-funds/source-of-wealth, SAR/STR references, and sanctions dispositions are not exposed in the general profile. |

## 12. Database/event audit queries

Adapt table and JSON syntax for the active database engine.

```sql
-- Confirm profile events exist after mutation tests.
select event_type, object_type, object_id, created_at
from events
where event_type in ('ContactProfileUpdated', 'ContactProfileEvidenceRecorded', 'ContactProfileRebuilt')
order by created_at desc;
```

```sql
-- Confirm profile JSON exists only as normalized profile/evidence slices.
select id, display_name, attrs_json
from parties
where attrs_json like '%business_profile%'
order by updated_at desc;
```

```sql
-- Confirm no obvious raw provider payload keys were persisted.
select id, display_name
from parties
where attrs_json like '%raw_payload%'
   or attrs_json like '%api_key%'
   or attrs_json like '%access_token%';
```

## 13. Merge readiness decision

The PR may move from draft to ready for review when all boxes below are checked.

```text
[ ] Compile gate passed.
[ ] Python tests passed.
[ ] Frontend tests passed.
[ ] Frontend static build passed.
[ ] Candidate verifier passed.
[ ] Browser QA passed.
[ ] Permission failure path verified.
[ ] Evidence/provenance path verified.
[ ] Data-point catalogue reviewed.
[ ] Alias/contact-point/identifier multiplicity reviewed.
[ ] Fraud/AML/KYC/scam-risk treatment reviewed.
[ ] No raw provider payloads stored.
[ ] No provider credentials or secrets committed.
[ ] Architecture docs updated.
[ ] Developer handoff plan updated.
[ ] Audit checklist completed.
```

## 14. Reviewer sign-off template

```text
Reviewer:
Date:
Commit SHA reviewed:
Verification logs reviewed:
Manual QA evidence reviewed:
Data-point catalogue reviewed:
Security/privacy notes:
Open blockers:
Decision: approve / changes requested / keep draft
```

## 15. External reference baseline

Use these as audit references, not as legal advice:

- NIST Privacy Framework: https://www.nist.gov/privacy-framework
- GDPR Article 5 principles: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng
- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
- Contact BI data-point catalogue: `docs/modules/contacts.core/CONTACT_BI_REPORT_DATA_POINTS.md`

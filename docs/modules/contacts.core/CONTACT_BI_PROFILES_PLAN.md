# Contact Business Intelligence Profiles Plan

**Module:** `contacts.core`

**Feature branch:** `feature/contact-bi-profiles`

**Primary PR:** `#1` — `Add native contact business intelligence profiles`

**Status:** First native profile slice is drafted on the feature branch. This document is the developer handoff plan for completing, validating, and preparing the feature for audit.

**Companion audit checklist:** `docs/modules/contacts.core/CONTACT_BI_PROFILES_AUDIT.md`

## 1. Outcome

UOK should provide a native business intelligence profile for every contact record. A contact can be a person or an organization. The profile must help operators understand who the contact is, why the relationship matters, how complete/trusted the profile is, and what evidence supports each enriched fact.

The implementation must remain native to UOK:

- `contacts.core` owns the profile behavior.
- The kernel remains product-neutral.
- The manifest declares all commands, events, API routes, permissions, and owned data surfaces.
- Profile facts are auditable, permissioned, and minimised.
- External enrichment is adapter-based and disabled unless deployment policy explicitly enables it.

## 2. Design principles

| Principle | Requirement |
|---|---|
| Native contact integration | A profile appears on each contact through the normal Contacts detail/read model, not as a disconnected app. |
| Evidence first | Every external or generated fact must be traceable to a source record with provider, confidence, fields, terms, and capture metadata. |
| Normalized facts only | Store normalized business facts, not raw provider payloads. |
| Privacy by default | Keep `sensitive_fields_excluded=true`; do not store protected-class, health, biometric, precise-location, political, religious, or unrelated personal-life facts. |
| Operator control | Respect `governance.do_not_enrich` before any future provider call. |
| Command/event auditability | All mutations must flow through the UOK command bus and emit contact profile events. |
| Incremental storage | Use `Party.attrs_json` slices for the first release; graduate to module-owned profile tables when query scale, purge granularity, or analytics require it. |
| Provider independence | Provider adapters return a UOK-normalized evidence object. No provider schema should leak into core contact records. |

## 3. Current implementation map

The first slice is expected to exist on `feature/contact-bi-profiles`:

| Area | Files | Expected state |
|---|---|---|
| Profile schema | `modules/contacts.core/backend/uok_contacts_core/profile_schemas.py` | Defines profile, person, organization, relationship, governance, source, write, evidence, and rebuild request models. |
| Profile service | `modules/contacts.core/backend/uok_contacts_core/profile_service.py` | Reads/writes JSON slices, merges evidence, rebuilds from contact data, scores profile health, caps source/evidence lists. |
| API schemas | `modules/contacts.core/backend/uok_contacts_core/api_schemas.py`, `src/uok/contact_api_schemas.py`, `src/uok/api/schemas.py`, `src/uok/main.py` | Exposes profile request schemas without importing module internals directly into product-neutral code beyond compatibility facades. |
| Commands | `modules/contacts.core/backend/uok_contacts_core/commands.py` | Adds `UpdateContactProfile`, `RecordContactProfileEvidence`, `RebuildContactProfile` handlers and permissions. |
| REST API | `modules/contacts.core/backend/uok_contacts_core/api.py` | Adds profile read/write/evidence/rebuild endpoints under `/api/contacts/{party_id}`. |
| Read model | `modules/contacts.core/backend/uok_contacts_core/read_model.py` | Includes `business_profile` summaries and profile fields in search text. |
| Manifest | `modules/contacts.core/manifest.yaml` | Declares profile commands/events and JSON slices as module-owned surfaces. |
| UI | `web/src/shared/types.ts`, `web/src/shared/options.ts`, `web/src/features/contacts/ContactDetailPanel.tsx` | Adds an Intelligence pane and profile summary rendering. |
| Candidate verifier | `modules/contacts.core/tests/verify/UokCandidateContacts.ps1` | Exercises evidence recording, profile read, rebuild, scoring, and permission failures. |
| Architecture note | `docs/architecture/UOK_CONTACT_BUSINESS_INTELLIGENCE_PROFILES.md` | Records high-level architecture, decisions, source basis, and phase plan. |

## 4. End-to-end build plan

### D0 — Confirm branch and candidate baseline

**Developer tasks**

1. Pull `feature/contact-bi-profiles`.
2. Confirm the branch is ahead of `main` and has no accidental unrelated files.
3. Confirm PR `#1` is still draft until all gates pass.
4. Confirm module manifests still satisfy the module-extension contract.

**Commands**

```powershell
git fetch origin
git checkout feature/contact-bi-profiles
git diff --stat origin/main...HEAD
git diff --name-only origin/main...HEAD
```

**Done when**

- The changed-file list matches the profile feature scope.
- No product-specific behavior has been added to `src/uok` except documented compatibility facades and schema re-exports.

### D1 — Complete the profile schema

**Developer tasks**

1. Review `profile_schemas.py` for field names, limits, defaults, and Pydantic compatibility with the repository's pinned dependency set.
2. Keep the first release schema stable and versioned by `schema_version`.
3. Keep the profile broad enough for person and organization records without assuming sales-only workflows.
4. Keep `ProfileGovernance` explicit:
   - `allowed_uses`
   - `consent_basis`
   - `retention_hint`
   - `do_not_enrich`
   - `sensitive_fields_excluded`
5. Confirm bounded text/list sizes prevent unbounded JSON growth.

**Acceptance criteria**

- Empty person/organization profiles validate.
- Write request accepts partial updates.
- Evidence request requires a source and accepts normalized facts.
- Rebuild request can run with default settings.
- Invalid confidence values fail validation.

**Recommended tests**

- Unit tests for Pydantic validation.
- Unit tests for maximum tag/list/source caps.
- Unit tests for schema backward compatibility if an older profile JSON lacks a newly added field.

### D2 — Complete the profile service

**Developer tasks**

1. Verify `business_profile_from_party` is tolerant of absent or malformed profile JSON.
2. Verify `save_business_profile` updates `updated_at`, recalculates scores, caps evidence/source lists, and persists only under `business_profile`.
3. Verify `record_profile_evidence` appends only normalized facts and source metadata under `business_profile_evidence`.
4. Verify `merge_normalized_facts` only accepts known profile sections and validates nested person/organization/relationship patches.
5. Verify `rebuild_business_profile` can derive an initial summary from existing contact fields and readable relationships/notes.
6. Confirm `score_profile` is deterministic.

**Scoring expectations**

| Score | Meaning | Inputs |
|---|---|---|
| `completeness` | How much basic/profile data exists | Display name, contact methods, summary, person or organization intelligence fields. |
| `confidence` | Highest profile confidence value mapped to 0-100 | `unknown`, `low`, `medium`, `high`, `verified`. |
| `provenance` | Quantity of source evidence, capped at 100 | Number of sources. |
| `relationship` | Relationship-specific readiness | stakeholder role, stage, strength, next step. |
| `profile_health` | Composite operator-facing score | Weighted completeness, confidence, provenance, relationship. |

**Acceptance criteria**

- Rebuild is idempotent except for source timestamps and capped source history.
- Evidence merge preserves existing profile data unless normalized facts intentionally update fields.
- Evidence count never exceeds `MAX_PROFILE_EVIDENCE_ITEMS`.
- `business_profile_summary` is safe to call from list/search paths.

### D3 — Complete commands and events

**Developer tasks**

1. Confirm the command bus discovers profile handlers from `uok_contacts_core.commands:command_handlers`.
2. Confirm permissions are declared in `command_permissions` and not hardcoded in the kernel.
3. Confirm all profile mutations call `touch_party`.
4. Confirm all profile mutations emit events with safe payloads:
   - `ContactProfileUpdated`
   - `ContactProfileEvidenceRecorded`
   - `ContactProfileRebuilt`
5. Confirm purged contacts cannot be profiled.

**Acceptance criteria**

- `contacts.manage` is required for profile writes/evidence/rebuilds.
- `contacts.read` is sufficient only for reading profile and evidence.
- Viewer cannot replay or execute privileged profile writes using another user's idempotency key.
- Event payloads do not include raw provider payloads or sensitive fields.

### D4 — Complete REST API integration

**Developer tasks**

1. Verify these endpoints exist and are OpenAPI-compatible:
   - `GET /api/contacts/{party_id}/profile`
   - `PATCH /api/contacts/{party_id}/profile`
   - `POST /api/contacts/{party_id}/profile/evidence`
   - `GET /api/contacts/{party_id}/profile/evidence`
   - `POST /api/contacts/{party_id}/profile/rebuild`
2. Confirm `require_contacts_module_operational` runs on read paths.
3. Confirm command-backed write paths return consistent error shapes for permission and validation errors.
4. Confirm `contact_detail` includes `business_profile` summary.

**Acceptance criteria**

- Disabled/uninstalled `contacts.core` blocks all profile routes.
- Missing contact returns `404` for read paths.
- Permission failures return `403`.
- Invalid profile/evidence payloads return Pydantic validation errors or controlled `400` responses.

### D5 — Complete read-model and search integration

**Developer tasks**

1. Confirm list/search result shape includes a concise `business_profile` object.
2. Confirm search can find contacts by profile summary, tags, and risk flags.
3. Confirm search does not expose non-readable contacts, notes, relationships, or profile details.
4. Confirm profile summaries do not trigger persistence as a side effect.

**Acceptance criteria**

- A viewer can search only records they can read.
- A profile with tags such as `decision_maker` is discoverable by query.
- Profile evidence rows are not returned in list results.

### D6 — Complete Contacts UI integration

**Developer tasks**

1. Confirm `ContactDetailPane` includes `intelligence`.
2. Confirm the detail segmented control shows Overview, Intelligence, Activity, Relationships.
3. Confirm the Intelligence pane renders:
   - summary
   - confidence
   - source count
   - profile health
   - completeness
   - updated timestamp
   - tags
   - risk flags
   - normalized-facts-only indicator
4. Add a disabled or future-labeled action area if write/rebuild UI is intentionally deferred.
5. Confirm empty profile state is helpful.
6. Confirm light, dark, and system themes remain usable.
7. Confirm no direct provider branding appears unless a provider is actually configured.

**Acceptance criteria**

- No TypeScript errors.
- No console errors in contact detail view.
- Existing contact views still work.
- Intelligence pane displays gracefully for contacts without a persisted profile.

### D7 — Complete tests and candidate verifier

**Developer tasks**

1. Add/confirm unit tests for `profile_schemas.py` and `profile_service.py`.
2. Add/confirm API tests for profile read/write/evidence/rebuild routes.
3. Extend candidate verifier with the profile happy path and permission path.
4. Confirm profile tests run under the existing candidate verification script.

**Minimum test scenarios**

| Scenario | Expected result |
|---|---|
| Viewer reads profile | Succeeds if contact is readable. |
| Viewer writes profile | Fails with `403`. |
| Ops records evidence | Succeeds and returns `evidence_count >= 1`. |
| Evidence merge updates summary/tags/person fields | Profile reflects normalized facts. |
| Rebuild with verified source | Confidence becomes `verified` when source is verified. |
| Purged contact profile write | Fails. |
| Search by profile tag | Returns only readable matching contacts. |
| Oversized summary/list/tag | Validation failure or truncation according to schema/service rules. |

### D8 — Generate/update API client if applicable

**Developer tasks**

1. Inspect whether the project currently generates TypeScript API contracts.
2. If so, regenerate the client after profile schemas/routes are added.
3. Commit generated outputs only if generated files are normally committed in this repo.
4. Confirm frontend imports do not drift from generated API types.

**Acceptance criteria**

- Frontend build succeeds.
- Profile request/response types do not require hand-maintained duplicates except small UI summary shapes.

### D9 — Prepare external enrichment adapter phase

This is not required for the first PR merge, but the code and docs must leave a clean path.

**Developer tasks for the next phase**

1. Add an adapter protocol under the module backend, not the kernel:

```python
class ContactEnrichmentAdapter(Protocol):
    name: str

    def enrich_person(self, keys: ProfileIdentityKeys) -> ContactProfileEvidenceRequest: ...
    def enrich_organization(self, keys: ProfileIdentityKeys) -> ContactProfileEvidenceRequest: ...
```

2. Add `ProfileIdentityKeys` with only needed fields:
   - contact id
   - display name
   - email domain
   - website domain
   - company name
   - optional LinkedIn/social URL if already provided by the user
3. Add provider registry configuration.
4. Enforce `governance.do_not_enrich` before any provider call.
5. Add rate limits, retries, backoff, and provider timeout budgets.
6. Add source terms metadata to every evidence record.
7. Add review handling for low-confidence or conflicting facts.

**Acceptance criteria for adapter phase**

- No provider credentials are committed.
- Provider calls are disabled by default.
- Raw provider payloads are not stored in `Party.attrs_json`.
- Provider-specific terms are recorded in `ProfileSource.terms`.
- Operator can disable enrichment per contact.

### D10 — Plan normalized storage phase

Move from JSON slices to module-owned profile tables when UOK needs cross-contact segmentation, large evidence histories, field-level purge, or dashboard-grade analytics.

**Future tables**

| Table | Purpose |
|---|---|
| `contact_profiles` | One row per party profile with profile type, summary, governance, scores, timestamps. |
| `contact_profile_evidence` | Source/evidence rows with source type, provider, confidence, normalized facts, capture time, retention policy. |
| `contact_profile_scores` | Optional historical score snapshots. |
| `contact_profile_jobs` | Enrichment/rebuild job state, retry metadata, adapter name, error summaries. |

**Migration rules**

- Add module-owned migrations under `modules/contacts.core/migrations`.
- Keep backward compatibility with existing JSON profile slices during migration.
- Provide a one-time migration command or lifecycle upgrade hook.
- Add purge behavior that deletes profile/evidence rows when a contact is purged.

## 5. Data contract

### Contact list/detail summary

```json
{
  "business_profile": {
    "profile_type": "person",
    "summary": "...",
    "tags": ["decision_maker"],
    "scores": {"profile_health": 75, "completeness": 68},
    "confidence": "high",
    "risk_flags": [],
    "updated_at": "2026-07-07T00:00:00+00:00",
    "source_count": 2
  }
}
```

### Full profile shape

```json
{
  "schema_version": "2026-07-07",
  "profile_type": "person",
  "generated_by": "contacts.core",
  "updated_at": "2026-07-07T00:00:00+00:00",
  "summary": "...",
  "tags": [],
  "person": {},
  "organization": {},
  "relationship": {},
  "governance": {
    "allowed_uses": ["relationship_management", "business_development"],
    "consent_basis": null,
    "retention_hint": null,
    "do_not_enrich": false,
    "sensitive_fields_excluded": true
  },
  "scores": {},
  "confidence": "unknown",
  "risk_flags": [],
  "sources": []
}
```

### Evidence record shape

```json
{
  "source": {
    "provider": "manual-review",
    "source_type": "operator_review",
    "source_record_id": "ticket-123",
    "source_url": null,
    "captured_at": "2026-07-07T00:00:00+00:00",
    "confidence": "high",
    "fields": ["summary", "person.current_title"],
    "terms": {"allowed_use": "internal_relationship_management"}
  },
  "normalized_facts": {
    "summary": "...",
    "person": {"current_title": "VP Operations"}
  },
  "merge_into_profile": true
}
```

## 6. Verification gate

Before the developer marks the PR ready for review, run:

```powershell
python -m compileall -q src modules tests
python -m pytest -q
npm --prefix web test
npm --prefix web run build:static
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify_uok_candidate.ps1
```

Also perform the manual browser gate:

1. Install/enable `contacts.core`.
2. Create a person contact.
3. Record profile evidence through API or command bus.
4. Open the contact detail view.
5. Confirm the Intelligence pane renders the profile summary and scores.
6. Confirm the viewer role cannot write profile evidence.
7. Archive/restore the contact and confirm profile remains intact.
8. Purge the contact and confirm profile write routes reject it.

## 7. Audit readiness checklist

The feature is audit-ready when:

- Profile data ownership is manifest-declared.
- Write paths are command/event audited.
- Read/write permissions are tested.
- Evidence stores normalized facts plus source metadata only.
- No raw provider payloads or credentials are stored.
- `do_not_enrich` exists before adapter work begins.
- Sensitive categories are excluded by schema policy and tests.
- Verification commands pass.
- Browser QA passes.
- `CONTACT_BI_PROFILES_AUDIT.md` is completed with commit hashes, run logs, and reviewer sign-off.

## 8. External reference baseline

Use these as engineering reference points, not as legal advice:

- NIST Privacy Framework: https://www.nist.gov/privacy-framework
- GDPR Article 5 principles: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng
- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
- Twenty CRM: https://github.com/twentyhq/twenty
- Monica PRM: https://github.com/monicahq/monica
- SuiteCRM: https://github.com/SuiteCRM/SuiteCRM-Core
- CiviCRM: https://github.com/civicrm/civicrm-core
- Frappe CRM: https://github.com/frappe/crm
- Krayin CRM: https://github.com/krayin/laravel-crm
- People Data Labs person/company enrichment docs: https://docs.peopledatalabs.com/
- Apollo API docs: https://docs.apollo.io/

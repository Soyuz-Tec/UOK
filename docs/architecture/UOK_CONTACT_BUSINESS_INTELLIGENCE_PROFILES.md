# UOK Contact Business Intelligence Profiles

**Status:** Architecture decision and implementation handoff for the native `contacts.core` business intelligence profile slice.

**Feature branch:** `feature/contact-bi-profiles`

**Primary PR:** `#1` — `Add native contact business intelligence profiles`

## Artifact map

| Artifact | Purpose |
|---|---|
| `docs/modules/contacts.core/CONTACT_BI_PROFILES_PLAN.md` | Developer end-to-end plan, implementation tasks, data contract, acceptance criteria, future enrichment phases. |
| `docs/modules/contacts.core/CONTACT_BI_REPORT_DATA_POINTS.md` | Peer-report analysis and comprehensive data-point catalogue for aliases, identifiers, contact points, ownership, AML/KYC, sanctions, fraud, scam, and adverse-media signals. |
| `docs/modules/contacts.core/CONTACT_BI_PROFILES_AUDIT.md` | Verification/audit checklist, commands, permission checks, API smoke tests, reviewer sign-off template. |
| `docs/modules/contacts.core/CONTACTS_APP_PLAN.md` | Broader Contacts app plan with the BI profile extension linked into the module roadmap. |
| `modules/contacts.core/manifest.yaml` | Declares profile commands, events, API prefix, owned data slices, permissions, and candidate verifier. |

## Decision summary

UOK will profile every contact through a native Contacts business intelligence profile layer. The first release stores normalized profile facts in the existing `Party.attrs_json` document under two manifest-declared module-owned slices:

- `business_profile`
- `business_profile_evidence`

This keeps the first release small, avoids expanding the shared baseline migration, and preserves a clear migration path to module-owned profile tables when cross-contact analytics, purge granularity, or evidence volume require relational storage.

## Goals

1. Give operators a concise business profile for every person and organization contact.
2. Make profile facts explainable through source evidence, confidence, allowed-use metadata, and freshness indicators.
3. Keep all profile behavior owned by `contacts.core` rather than the core UOK platform.
4. Support future enrichment providers without binding UOK to any provider's schema.
5. Make verification and audit possible through command/event trails, candidate verifier steps, and a dedicated audit checklist.

## Non-goals for the first PR

- No live external enrichment calls.
- No provider credentials.
- No raw provider payload storage.
- No normalized profile tables yet.
- No automated scoring beyond deterministic local profile-health/completeness/confidence/provenance/relationship scores.
- No sales-pipeline-specific assumptions.

## Open-source CRM benchmark

Patterns reviewed:

| Project | Relevant pattern | UOK decision |
|---|---|---|
| Twenty | Code-first/custom-object CRM with object, field, view, workflow, and agent building blocks. | Keep UOK profiles as typed module extension data rather than adding a generic CRM object engine now. |
| Monica | Relationship-focused contact sheet with notes, activities, labels, reminders, and privacy-first ownership posture. | Profiles should blend structured facts with relationship context and keep user control explicit. |
| SuiteCRM | Enterprise CRM emphasizes API-first architecture, extensibility, and user-owned/customizable deployment. | Profile endpoints should be first-class REST surfaces and command/event audited. |
| CiviCRM | Constituent/contact model supports multiple host applications and nonprofit-specific relationship management. | Keep the profile schema broad enough for people and organizations without assuming a sales-only workflow. |
| Frappe CRM | Simple, customizable, open-source CRM for leads, deals, notes, tasks, views, and communications. | Preserve UOK's lightweight contact workflow and add intelligence without turning contacts into a full pipeline module. |
| Krayin | Modular CRM framework with custom attributes and lifecycle features. | Store profile data through a module-owned extension point and declare ownership explicitly in the manifest. |

## Business intelligence report benchmark

Peer report formats converge on a fact graph rather than a flat contact card. UOK should model these data groups over time:

- multiple names, aliases, former names, trade names, transliterations, and native-script names;
- multiple emails, phones, websites, social profiles, and addresses with type, active/historical status, first/last seen, source count, and confidence;
- legal identifiers, registry IDs, LEI/D-U-N-S/CIK/ticker/MIC/tax IDs, and provider IDs;
- person employment, officer, director, stakeholder, board, and beneficial-owner roles;
- organization registration, jurisdiction, status, legal form, filings, locations, industries, scale, funding, public-company metadata, parent/subsidiary/affiliate graph;
- sanctions, PEP/RCA, adverse-media, enforcement, debarment, scam, and fraud screening facts;
- source evidence, allowed use, retention, confidence, reviewer disposition, and next review dates.

The authoritative catalogue and implementation guidance are maintained in `docs/modules/contacts.core/CONTACT_BI_REPORT_DATA_POINTS.md`.

## Target architecture

```text
Contact record
  -> identity and relationship context
  -> profile service
  -> normalized profile facts
  -> evidence/source records
  -> profile scoring
  -> command/event audit
  -> Contacts read model/search
  -> Contacts Intelligence pane
```

Future external enrichment adds one step before evidence persistence:

```text
Contact identity keys
  -> provider adapter
  -> normalized evidence request
  -> policy checks: do_not_enrich, allowed use, retention, rate limit
  -> evidence record
  -> profile merge/review
```

## Profile schema

Each profile has these major sections:

- `summary`: concise human-readable business profile.
- `person`: title, company, seniority, department, decision role, professional summary, locations, skills, social profiles.
- `organization`: legal name, domains, industries, size/revenue ranges, headquarters, funding stage, technologies, competitors.
- `relationship`: owner, stakeholder role, relationship stage, relationship strength, priority, sentiment, last interaction, next step.
- `governance`: allowed uses, consent basis, retention hint, `do_not_enrich`, and `sensitive_fields_excluded`.
- `sources`: normalized provenance records with provider, source type, source record id, source URL, captured time, confidence, fields, and terms metadata.
- `scores`: computed completeness, confidence, provenance, relationship, and profile health scores.
- `risk_flags`: reviewable profile quality or compliance flags.

## Evidence model

The profile system stores normalized facts plus source metadata, not unbounded raw enrichment payloads. This keeps the first slice small and auditable:

```json
{
  "source": {
    "provider": "candidate-verifier",
    "source_type": "manual_review",
    "confidence": "high",
    "fields": ["summary", "tags", "person"]
  },
  "normalized_facts": {
    "summary": "Candidate verified business profile...",
    "tags": ["candidate_verified", "profiled"]
  },
  "recorded_at": "2026-07-07T00:00:00+00:00"
}
```

## API and command surface

The implementation declares and handles these commands:

- `UpdateContactProfile`
- `RecordContactProfileEvidence`
- `RebuildContactProfile`

The implementation exposes these REST endpoints under the module-owned `/api/contacts` prefix:

- `GET /api/contacts/{party_id}/profile`
- `PATCH /api/contacts/{party_id}/profile`
- `POST /api/contacts/{party_id}/profile/evidence`
- `GET /api/contacts/{party_id}/profile/evidence`
- `POST /api/contacts/{party_id}/profile/rebuild`

Read access uses `contacts.read`. Write/rebuild/evidence actions flow through the UOK command bus and require `contacts.manage`.

## Developer completion plan

The developer must use `docs/modules/contacts.core/CONTACT_BI_PROFILES_PLAN.md` as the authoritative handoff checklist. At minimum, completion requires:

1. Confirm schema/service/command/API/read-model/UI implementation matches the plan.
2. Add or adjust tests for profile schemas, profile service, API routes, permissions, search, and UI types.
3. Use `docs/modules/contacts.core/CONTACT_BI_REPORT_DATA_POINTS.md` as the source for future multi-valued data-point and risk-signal modelling.
4. Run all automated verification commands.
5. Exercise browser QA for the Contacts Intelligence pane.
6. Fill out `CONTACT_BI_PROFILES_AUDIT.md` with evidence and reviewer notes.
7. Keep PR `#1` draft until gates pass.

## Verification and audit plan

The audit checklist defines automated commands, API smoke tests, browser QA, security/privacy checks, database/event queries, and reviewer sign-off. The PR should not be marked ready until these commands pass:

```powershell
python -m compileall -q src modules tests
python -m pytest -q
npm --prefix web test
npm --prefix web run build:static
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify_uok_candidate.ps1
```

## Privacy, safety, and compliance controls

1. **Data minimization:** store normalized business facts needed for allowed UOK workflows, not raw provider blobs.
2. **Purpose limitation:** each profile includes allowed-use metadata.
3. **Provenance:** every enrichment fact has provider/source/confidence metadata.
4. **Freshness:** scores include provenance and completeness now; future enrichment jobs should mark stale evidence.
5. **Sensitive data exclusion:** the schema defaults `sensitive_fields_excluded` to true and should not store protected-class, precise location, health, biometric, or unrelated personal-life data.
6. **Operator control:** contacts can set `do_not_enrich` in the governance section before future automated enrichment runs.
7. **Retention:** the manifest declares profile and evidence retention behavior; a later normalized-table migration should add field-level purge support.
8. **Fraud/AML/KYC separation:** general business profiles must stay separate from restricted compliance artifacts such as government identifiers, sanctions dispositions, SAR/STR references, and source-of-funds/source-of-wealth evidence.

## Release phases

### Phase 1 — Native profile foundation

Included in the current branch:

- typed profile schemas;
- profile service for create/read/merge/rebuild/score;
- command handlers and permissions through `contacts.core`;
- REST API routes;
- contact list/search summary integration;
- Contacts UI Intelligence pane;
- candidate verifier profile scenario;
- architecture, developer plan, report data-point catalogue, and audit artifacts.

### Phase 2 — External enrichment adapters

Add after Phase 1 passes audit:

- provider registry and adapter protocol;
- configuration for provider credentials;
- rate limiting and retry queues;
- provider-specific terms metadata on evidence;
- `do_not_enrich` enforcement before adapter calls;
- optional review queue for low-confidence or conflicting facts;
- multi-valued aliases, contact points, identifiers, risk signals, and screening summaries as described in the report data-point catalogue.

### Phase 3 — Normalized profile tables

Move from JSON slices to indexed tables when UOK needs cross-contact segmentation, large evidence histories, deletion/purge granularity, AML/KYC access separation, or dashboard-level analytics:

- `contact_profiles`
- `contact_profile_evidence`
- `contact_profile_scores`
- `contact_profile_jobs`
- `party_aliases`
- `party_contact_points`
- `party_identifiers`
- `party_locations`
- `party_screening_runs`
- `party_screening_hits`
- `party_risk_signals`
- `party_risk_reviews`

## Source references

- Twenty CRM: https://github.com/twentyhq/twenty
- Monica PRM: https://github.com/monicahq/monica
- SuiteCRM: https://github.com/SuiteCRM/SuiteCRM-Core
- CiviCRM: https://github.com/civicrm/civicrm-core
- Frappe CRM: https://github.com/frappe/crm
- Krayin CRM: https://github.com/krayin/laravel-crm
- People Data Labs Person and Company Schema: https://docs.peopledatalabs.com/
- OpenCorporates API reference: https://api.opencorporates.com/documentation/API-Reference
- GLEIF Legal Entity Identifier overview: https://www.gleif.org/en/organizational-identity/lei-vlei/the-legal-entity-identifier-lei
- FATF Recommendations: https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html
- FFIEC BSA/AML Beneficial Ownership Requirements: https://bsaaml.ffiec.gov/manual/AssessingComplianceWithBSARegulatoryRequirements/03
- OpenSanctions entity model: https://www.opensanctions.org/docs/entities/
- FBI IC3 Business Email Compromise guidance: https://www.ic3.gov/CrimeInfo/BEC
- FTC scam guidance: https://consumer.ftc.gov/articles/how-avoid-scam
- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/

# UOK Contact Business Intelligence Profiles

**Status:** Draft implementation plan with first backend/UI slice in `contacts.core`.

## Goal

UOK needs a native profile layer for every contact. The profile should turn raw people and organization records into useful business intelligence while staying consistent with UOK's modular-monolith rules: business behavior belongs in modules, contacts behavior belongs in `contacts.core`, and the kernel stays product-neutral.

The first implementation slice stores normalized profile facts inside the existing `Party.attrs_json` document under two declared module-owned slices:

- `business_profile`
- `business_profile_evidence`

This avoids a schema migration for the first release while preserving a forward path to module-owned profile tables if query volume, reporting, or retention controls require normalization later.

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

## Enrichment architecture

Recommended provider abstraction:

```text
Contact -> identity keys -> enrichment adapter -> normalized facts -> evidence record -> profile merge -> score -> event
```

Adapters should be provider-specific and return a common normalized payload:

```python
class EnrichmentAdapter(Protocol):
    def enrich_person(self, keys: ProfileIdentityKeys) -> ProfileEvidence: ...
    def enrich_organization(self, keys: ProfileIdentityKeys) -> ProfileEvidence: ...
```

Recommended provider categories:

- People/company enrichment: People Data Labs, Apollo, FullContact, Clearbit/HubSpot-style enrichment.
- Company/funding data: Crunchbase-style organization enrichment.
- Internal UOK data: notes, relationships, import source, ownership, review state, and future meeting/email modules.
- Manual analyst input: high-confidence source when an operator reviews and approves facts.

Provider selection should remain configuration-driven and disabled by default until consent, terms, and deployment policies are explicitly configured.

## Privacy, safety, and compliance controls

1. **Data minimization:** store normalized business facts needed for allowed UOK workflows, not raw provider blobs.
2. **Purpose limitation:** each profile includes allowed-use metadata.
3. **Provenance:** every enrichment fact has provider/source/confidence metadata.
4. **Freshness:** scores include provenance and completeness now; future enrichment jobs should mark stale evidence.
5. **Sensitive data exclusion:** the schema defaults `sensitive_fields_excluded` to true and should not store protected-class, precise location, health, biometric, or unrelated personal-life data.
6. **Operator control:** contacts can set `do_not_enrich` in the governance section before future automated enrichment runs.
7. **Retention:** the manifest declares profile and evidence retention behavior; a later normalized-table migration should add field-level purge support.

## Release phases

### Phase 1: Native profile foundation — implemented on this branch

- Typed profile schemas.
- Profile service for create/read/merge/rebuild/score.
- Command handlers and permissions through `contacts.core`.
- REST API routes.
- Contact list/search summary integration.
- Contacts UI Intelligence pane.
- Candidate verifier profile scenario.

### Phase 2: External enrichment adapters

- Provider registry and adapter protocol.
- Configuration for provider credentials.
- Rate limiting and retry queues.
- Provider-specific terms metadata on evidence.
- `do_not_enrich` enforcement before adapter calls.
- Optional review queue for low-confidence or conflicting facts.

### Phase 3: Normalized profile tables

- `contact_profiles`
- `contact_profile_evidence`
- `contact_profile_scores`
- `contact_profile_jobs`

Move from JSON slices to indexed tables when UOK needs cross-contact segmentation, large evidence histories, deletion/purge granularity, or dashboard-level analytics.

## Source references

- Twenty CRM: https://github.com/twentyhq/twenty
- Monica PRM: https://github.com/monicahq/monica
- SuiteCRM: https://github.com/SuiteCRM/SuiteCRM-Core
- CiviCRM: https://github.com/civicrm/civicrm-core
- Frappe CRM: https://github.com/frappe/crm
- Krayin CRM: https://github.com/krayin/laravel-crm
- NIST Privacy Framework: https://www.nist.gov/privacy-framework
- GDPR Article 5: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng
- People Data Labs docs: https://docs.peopledatalabs.com/
- Apollo API docs: https://docs.apollo.io/

# Contact Business Intelligence Report Data Points

**Module:** `contacts.core`

**Feature branch:** `feature/contact-bi-profiles`

**Primary PR:** `#1` — `Add native contact business intelligence profiles`

**Status:** Research-backed data catalogue and implementation guidance for UOK contact business intelligence, fraud detection, AML, KYC, sanctions, and scam-risk reporting.

**Companion docs:**

- `docs/architecture/UOK_CONTACT_BUSINESS_INTELLIGENCE_PROFILES.md`
- `docs/modules/contacts.core/CONTACT_BI_PROFILES_PLAN.md`
- `docs/modules/contacts.core/CONTACT_BI_PROFILES_AUDIT.md`

## 1. Purpose

This document translates peer business intelligence, company intelligence, sales enrichment, AML/KYC, sanctions, adverse-media, and scam/fraud report formats into a UOK data-point catalogue.

The catalogue is intentionally broad. It defines what UOK should be able to model over time, not what the first PR must persist. The first PR can store a safe summary and evidence-backed normalized facts. Later phases can move high-value fields into module-owned tables and add regulated AML/KYC controls after legal/compliance review.

## 2. Core conclusion

Peer systems do not treat a person or company as a flat record with one name, one email, one phone number, and one address. They model a contact as a graph of evidence-backed facts:

```text
Party
  -> names and aliases
  -> identifiers
  -> contact points
  -> addresses and locations
  -> organizations and roles
  -> ownership/control relationships
  -> source evidence
  -> watchlist/adverse-media/sanctions screening
  -> risk signals and review outcomes
```

UOK should therefore model contact BI profiles as multi-valued, source-backed facts with confidence, timestamps, allowed use, and review state.

## 3. Peer report formats reviewed

| Peer/report family | Typical report sections | Data points to carry forward into UOK |
|---|---|---|
| Sales/contact enrichment reports | Identity, aliases, email/phone arrays, social profiles, job title, seniority, department, company, location, skills, source metadata. | Multi-valued names, emails, phones, social profiles, role history, company association, evidence timestamps. |
| Company enrichment reports | Company ID, name/display name, alternative names, domains, locations, industry, headcount, funding, ticker/exchange, parent/affiliate graph, job postings. | Legal/display/trade names, previous names, domains, websites, locations, sector codes, headcount/revenue, funding, parent/subsidiary/affiliate relationships. |
| Company registry reports | Registration number, jurisdiction, legal form, incorporation/dissolution dates, active/inactive status, registered address, officers, filings, previous names. | Registry identifiers, authoritative legal status, officer/director relationships, filings, previous names, address history. |
| Legal-entity identifier reports | LEI, legal name, registration status, local authoritative source, level 1 identity, level 2 ownership relationships. | LEI and registration-authority mappings; `who is who` and `who owns whom` relationships. |
| Commercial credit/business reports | D-U-N-S or equivalent ID, business structure, principals, credit score, payment behavior, public records, ownership, regulatory filings. | Commercial-credit identifiers, payment history, credit risk score, public-record risk, ownership/principal data. |
| Sanctions/watchlist reports | Names, aliases, transliterations, nationality, birth date, documents/passports, addresses, sanctions program/list, listing dates, target topics, source datasets. | Screening hits, matched fields, list/source, sanctions program, aliases, identifiers, dates, disposition, reviewer notes. |
| AML/KYC due-diligence reports | Customer identity, beneficial owners, control person, ownership percentages, source of funds/wealth, expected activity, PEP/sanctions/adverse media, risk rating, review cadence. | Beneficial ownership graph, control prong, ownership prong, ID verification, risk tier, review cadence, source-of-funds/wealth, suspicious-activity indicators. |
| Adverse-media/ESG reports | Incidents, source links, publication/event dates, severity, topics such as fraud/corruption/tax evasion/human rights, risk rating, watchlist status. | Adverse-media incident records with topic, severity, source reliability, recency, linked entities, confidence, disposition. |
| Scam/fraud reports | Impersonation, payment-method pressure, account-change requests, fake invoices, BEC indicators, refund/check scams, urgency, communication channel artifacts. | Scam risk signals tied to contact methods, payment instructions, communications, invoices, and transaction behavior. |

## 4. Data classification for UOK

| Class | Meaning | Storage guidance |
|---|---|---|
| `P0_CORE` | Low-sensitivity business/contact facts needed for normal contact management. | Safe for `business_profile` summary if source and confidence are present. |
| `P1_BUSINESS_INTEL` | Enrichment, company, role, relationship, source, and scoring facts. | Store normalized facts with source evidence; avoid raw provider payloads. |
| `P2_RESTRICTED_COMPLIANCE` | KYC documents, government identifiers, beneficial owner IDs, source of funds, sanctions match details, SAR/STR references. | Do not place in general contact UI by default. Use restricted permissions, encryption/tokenization, retention rules, and audit logs. |
| `P3_EXCLUDED_OR_HIGH_RISK` | Protected-class data, health/biometric data, precise personal-life details, political/religious views, unrelated personal facts. | Do not collect or store unless a specific legal requirement and approved compliance control exists. |

## 5. Minimum viable data points for every UOK BI profile

These fields should be available before automated enrichment is enabled:

| Category | Data point | Multiplicity | Class | Notes |
|---|---:|---:|---|---|
| Internal identity | `party_id` | one | `P0_CORE` | Stable UOK identifier. |
| Internal identity | `party_type` | one | `P0_CORE` | `person`, `organization`, later `trust`, `vessel`, `account`, `unknown`. |
| Name | `display_name` | one | `P0_CORE` | Human-facing name. |
| Name | `legal_name` | zero/one | `P0_CORE` | Required for organizations when known. |
| Name | `name_aliases` | many | `P1_BUSINESS_INTEL` | DBA, AKA, FKA, trade names, transliterations, native script names, abbreviations. |
| Contact | `emails` | many | `P0_CORE`/`P1_BUSINESS_INTEL` | Each email has type, verified flag, domain, first/last seen, source, confidence. |
| Contact | `phones` | many | `P0_CORE`/`P1_BUSINESS_INTEL` | Each phone has E.164 value, type, line type, verified flag, first/last seen, source. |
| Address | `addresses` | many | `P0_CORE`/`P1_BUSINESS_INTEL` | Registered, HQ, mailing, billing, service, residential, branch, historical. |
| Digital | `websites/domains` | many | `P1_BUSINESS_INTEL` | Include canonical domain, alternate domains, domain mismatch risk signals. |
| Digital | `social_profiles` | many | `P1_BUSINESS_INTEL` | LinkedIn, Twitter/X, Facebook, Crunchbase, marketplace/seller profiles. |
| Profile | `summary` | one | `P1_BUSINESS_INTEL` | Human-readable profile. |
| Profile | `tags` | many | `P1_BUSINESS_INTEL` | Decision maker, supplier, investor, high risk, needs review, etc. |
| Profile | `confidence` | one | `P1_BUSINESS_INTEL` | Unknown/low/medium/high/verified. |
| Profile | `scores` | many | `P1_BUSINESS_INTEL` | Completeness, provenance, relationship, fraud, AML, KYC, profile health. |
| Evidence | `sources` | many | `P1_BUSINESS_INTEL` | Provider, record ID, URL, captured at, terms, confidence, fields. |
| Governance | `allowed_uses` | many | `P1_BUSINESS_INTEL` | Purpose limitation. |
| Governance | `do_not_enrich` | one | `P1_BUSINESS_INTEL` | Must be checked before provider calls. |
| Governance | `retention_hint` | zero/one | `P1_BUSINESS_INTEL` | Retention and purge guidance. |

## 6. Name and alias catalogue

Multiple names are normal and must not automatically imply fraud. They become risk signals when unexplained, inconsistent with source records, or linked to other red flags.

| Field | Applies to | Class | Description |
|---|---|---|---|
| `canonical_name` | all | `P0_CORE` | UOK-selected canonical name. |
| `display_name` | all | `P0_CORE` | UI name. |
| `legal_name` | organization | `P0_CORE` | Registry/legal name. |
| `registered_name` | organization | `P0_CORE` | Name as recorded by authority. |
| `trade_name` | organization | `P1_BUSINESS_INTEL` | DBA/trading-as name. |
| `brand_names` | organization | `P1_BUSINESS_INTEL` | Product/market brands. |
| `previous_names` | organization/person | `P1_BUSINESS_INTEL` | Former company names, maiden names, former legal names. |
| `name_aliases` | all | `P1_BUSINESS_INTEL` | AKA, FKA, nicknames, abbreviations, alternate spellings. |
| `transliterations` | all | `P1_BUSINESS_INTEL` | Cross-script equivalents. |
| `native_script_names` | all | `P1_BUSINESS_INTEL` | Local-script names. |
| `normalized_name` | all | `P1_BUSINESS_INTEL` | Search-normalized name. |
| `heavily_normalized_name` | all | `P1_BUSINESS_INTEL` | Punctuation/legal suffix stripped. |
| `name_language` | all | `P1_BUSINESS_INTEL` | ISO language if known. |
| `name_source` | all | `P1_BUSINESS_INTEL` | Source evidence for the name. |
| `name_first_seen` | all | `P1_BUSINESS_INTEL` | First observed date. |
| `name_last_seen` | all | `P1_BUSINESS_INTEL` | Last observed date. |
| `name_active` | all | `P1_BUSINESS_INTEL` | Whether currently active. |

### Alias fraud indicators

- Legal name and bank account name do not align.
- Multiple unrelated companies share nearly identical names, phone numbers, addresses, directors, or domains.
- Entity uses a name very similar to a known brand, bank, agency, charity, or supplier.
- Name recently changed shortly before a high-value transaction.
- Contact pushes payment to a name not associated with the profiled entity.
- Ownership split appears designed to avoid reporting thresholds.

## 7. Contact point catalogue

Each email, phone, address, and social profile should be a row/fact with source metadata, not a single field.

### 7.1 Email address fields

| Field | Class | Description |
|---|---|---|
| `email` | `P0_CORE` | Original address. |
| `normalized_email` | `P1_BUSINESS_INTEL` | Lowercased/canonicalized address for matching. |
| `email_type` | `P1_BUSINESS_INTEL` | Work, personal, role alias, support, billing, unknown. |
| `domain` | `P1_BUSINESS_INTEL` | Domain part. |
| `domain_age` | `P1_BUSINESS_INTEL` | Future enrichment; useful for scam detection. |
| `domain_matches_website` | `P1_BUSINESS_INTEL` | Boolean or confidence. |
| `deliverability_status` | `P1_BUSINESS_INTEL` | Verified, risky, invalid, unknown. |
| `is_primary` | `P0_CORE` | UI preference. |
| `is_active` | `P1_BUSINESS_INTEL` | Current vs historical. |
| `first_seen` | `P1_BUSINESS_INTEL` | Source timestamp. |
| `last_seen` | `P1_BUSINESS_INTEL` | Source timestamp. |
| `num_sources` | `P1_BUSINESS_INTEL` | Corroboration count. |
| `source_ids` | `P1_BUSINESS_INTEL` | Evidence references. |
| `do_not_email` | `P1_BUSINESS_INTEL` | Consent/contact preference. |
| `risk_flags` | `P1_BUSINESS_INTEL` | Disposable, freemail for business, typo-squatting, lookalike, recently changed. |

### 7.2 Phone number fields

| Field | Class | Description |
|---|---|---|
| `phone` | `P0_CORE` | Original phone. |
| `e164_phone` | `P1_BUSINESS_INTEL` | Normalized phone. |
| `phone_type` | `P1_BUSINESS_INTEL` | Mobile, work, landline, fax, WhatsApp, VoIP, unknown. |
| `country_code` | `P1_BUSINESS_INTEL` | Country calling code. |
| `carrier` | `P1_BUSINESS_INTEL` | Future enrichment. |
| `line_type` | `P1_BUSINESS_INTEL` | Mobile, VoIP, fixed, toll-free. |
| `is_primary` | `P0_CORE` | UI preference. |
| `is_active` | `P1_BUSINESS_INTEL` | Current vs historical. |
| `verified_at` | `P1_BUSINESS_INTEL` | Verification timestamp. |
| `first_seen` | `P1_BUSINESS_INTEL` | Source timestamp. |
| `last_seen` | `P1_BUSINESS_INTEL` | Source timestamp. |
| `num_sources` | `P1_BUSINESS_INTEL` | Corroboration count. |
| `do_not_call` | `P1_BUSINESS_INTEL` | Consent/contact preference. |
| `risk_flags` | `P1_BUSINESS_INTEL` | Shared by many identities, high churn, VoIP-only for high-value supplier, country mismatch. |

### 7.3 Address/location fields

| Field | Class | Description |
|---|---|---|
| `address_type` | `P0_CORE`/`P1_BUSINESS_INTEL` | Registered, HQ, branch, mailing, billing, residential, service, warehouse. |
| `address_line_1` | `P0_CORE`/`P2_RESTRICTED_COMPLIANCE` | Treat residential addresses as restricted. |
| `address_line_2` | `P0_CORE`/`P2_RESTRICTED_COMPLIANCE` | Suite/unit. |
| `locality` | `P0_CORE` | City/town. |
| `region` | `P0_CORE` | State/province. |
| `postal_code` | `P0_CORE` | Postal code. |
| `country` | `P0_CORE` | Country. |
| `geo` | `P1_BUSINESS_INTEL`/`P2_RESTRICTED_COMPLIANCE` | Approximate coordinates only unless needed. |
| `is_primary` | `P0_CORE` | UI preference. |
| `is_active` | `P1_BUSINESS_INTEL` | Current vs historical. |
| `first_seen` | `P1_BUSINESS_INTEL` | Source timestamp. |
| `last_seen` | `P1_BUSINESS_INTEL` | Source timestamp. |
| `source_ids` | `P1_BUSINESS_INTEL` | Evidence references. |
| `risk_flags` | `P1_BUSINESS_INTEL` | Mail drop, virtual office, shared by many high-risk entities, mismatch with jurisdiction, high-risk country. |

## 8. Person profile catalogue

| Category | Data point | Class | Notes |
|---|---|---|---|
| Identity | Full name, first/middle/last, suffix, initials | `P0_CORE` | Store name components when available. |
| Identity | Date of birth or year/month | `P2_RESTRICTED_COMPLIANCE` | Needed for KYC/watchlist disambiguation. |
| Identity | Nationality/citizenship/residence | `P2_RESTRICTED_COMPLIANCE` | Needed for AML/KYC in regulated workflows. |
| Identity | Government ID document metadata | `P2_RESTRICTED_COMPLIANCE` | Store type, issuing country, issue/expiry, verification status; avoid raw images by default. |
| Contact | Emails, phones, addresses, social profiles | varies | Multi-valued with evidence. |
| Professional | Current employer, title, seniority, department | `P1_BUSINESS_INTEL` | Useful for role and relationship intelligence. |
| Professional | Employment history | `P1_BUSINESS_INTEL` | Include start/end dates and source. |
| Professional | Board/officer/director roles | `P1_BUSINESS_INTEL`/`P2_RESTRICTED_COMPLIANCE` | Important for ownership/control and screening. |
| Professional | Licenses/registrations | `P1_BUSINESS_INTEL`/`P2_RESTRICTED_COMPLIANCE` | Jurisdiction, license ID, status, expiry. |
| Relationship | Stakeholder role, decision role, influence | `P1_BUSINESS_INTEL` | Internal relationship intelligence. |
| Risk | PEP/RCA status | `P2_RESTRICTED_COMPLIANCE` | Requires source, date, disposition. |
| Risk | Sanctions/watchlist/adverse media hits | `P2_RESTRICTED_COMPLIANCE` | Store match evidence and review disposition. |

## 9. Organization profile catalogue

| Category | Data point | Class | Notes |
|---|---|---|---|
| Legal identity | Legal name, display name, trade names, previous names | `P0_CORE`/`P1_BUSINESS_INTEL` | History matters for matching and fraud detection. |
| Registry | Registration number, native company number, jurisdiction | `P1_BUSINESS_INTEL` | Authoritative identity anchors. |
| Registry | Legal form/entity type | `P1_BUSINESS_INTEL` | Corporation, LLC, partnership, nonprofit, trust, branch, foreign entity. |
| Registry | Incorporation date, dissolution date, active/inactive status | `P1_BUSINESS_INTEL` | Needed for legitimacy and age checks. |
| Registry | Registry URL, filing IDs, updated/retrieved timestamps | `P1_BUSINESS_INTEL` | Evidence and freshness. |
| Identifiers | LEI, D-U-N-S, VAT, EIN/TIN, CIK, ticker, MIC exchange | varies | Treat tax IDs as restricted; public exchange IDs as business intel. |
| Contact | Registered address, HQ, locations, branch addresses | varies | Multi-valued. |
| Digital | Website, alternate domains, domain history, social profiles | `P1_BUSINESS_INTEL` | Needed for phishing/lookalike detection. |
| Business | Industry, NAICS/SIC/NACE, tags, description, products/services | `P1_BUSINESS_INTEL` | For segmentation and expected activity. |
| Scale | Employee count/range, revenue range, funding, public/private status | `P1_BUSINESS_INTEL` | Useful for due diligence and anomaly checks. |
| Ownership | Direct parent, ultimate parent, affiliates, subsidiaries | `P1_BUSINESS_INTEL`/`P2_RESTRICTED_COMPLIANCE` | Store relationship type, percentage, dates, source. |
| Control | Directors, officers, control person, beneficial owners | `P2_RESTRICTED_COMPLIANCE` | Required for KYC/AML workflows. |
| Credit/public records | Payment history, credit score, liens, judgments, bankruptcy, lawsuits | `P2_RESTRICTED_COMPLIANCE` | Requires provider terms and legal review. |
| Risk | Sanctions, adverse media, regulatory enforcement, debarment | `P2_RESTRICTED_COMPLIANCE` | Needs match disposition. |

## 10. Ownership, control, and relationship catalogue

| Relationship | From | To | Key fields |
|---|---|---|---|
| Employment | person | organization | title, department, seniority, start/end, current flag, source. |
| Officer/director | person | organization | position, start/end, registry source, active flag. |
| Beneficial owner | person/trust/entity | organization | direct/indirect %, voting %, control type, start/end, source, verification status. |
| Control person | person | organization | role, control basis, source, verification status. |
| Parent/subsidiary | organization | organization | direct/ultimate, percentage, start/end, status. |
| Affiliate | organization | organization | relationship type, evidence, dates. |
| Family/close associate | person | person | relationship type, source, confidence, PEP/RCA relevance. |
| Shared contact point | party | email/phone/address/domain | shared count, related parties, risk level. |
| Payment instrument | party | bank account/wallet/payment handle | verification status, beneficiary name, source, change history. |

### Beneficial ownership red flags

- Ownership split just below a reporting threshold.
- No natural person owns enough equity but one person appears to control operations.
- Nominee directors, nominee shareholders, bearer shares, or layered offshore entities.
- Frequent ownership changes around onboarding or high-value payments.
- Beneficial owners, directors, bank accounts, addresses, or domains mismatch the stated business.
- Owner or control person appears on sanctions, PEP, adverse-media, debarment, or enforcement lists.

## 11. AML/KYC data point catalogue

These fields are not all appropriate for general CRM. They require role-based access, audit logging, retention controls, and legal/compliance approval.

| Category | Data point | Class | Notes |
|---|---|---|---|
| Customer identification | Name, DOB, address, government identifier | `P2_RESTRICTED_COMPLIANCE` | Required in many KYC workflows for natural persons/beneficial owners. |
| Legal entity due diligence | Legal name, jurisdiction, formation document, principal place of business | `P2_RESTRICTED_COMPLIANCE` | Include verification source. |
| Beneficial ownership | Control prong person | `P2_RESTRICTED_COMPLIANCE` | One control person for legal entity KYC workflows. |
| Beneficial ownership | Ownership prong owners | `P2_RESTRICTED_COMPLIANCE` | Each qualifying natural owner, percentage, direct/indirect basis. |
| Purpose/nature | Relationship purpose, product/service expected use | `P2_RESTRICTED_COMPLIANCE` | Part of risk-based CDD. |
| Expected activity | Expected monthly transaction count/value, counterparties, countries, rails | `P2_RESTRICTED_COMPLIANCE` | Baseline for later behavior monitoring. |
| Source of funds | Description, documents, verification status | `P2_RESTRICTED_COMPLIANCE` | EDD field. |
| Source of wealth | Description, documents, verification status | `P2_RESTRICTED_COMPLIANCE` | EDD field. |
| Geography | Countries of incorporation, operation, residence, beneficial ownership, banks, counterparties | `P2_RESTRICTED_COMPLIANCE` | Include high-risk jurisdiction flags. |
| Screening | Sanctions, PEP, RCA, adverse media, enforcement, debarment | `P2_RESTRICTED_COMPLIANCE` | Include match score and disposition. |
| Risk rating | Initial risk tier, residual risk, rationale, reviewer, review cadence | `P2_RESTRICTED_COMPLIANCE` | Must be explainable. |
| Monitoring | Last review date, next review date, trigger reason | `P2_RESTRICTED_COMPLIANCE` | Risk-based refresh. |
| Disposition | True hit, false positive, unresolved, escalated | `P2_RESTRICTED_COMPLIANCE` | Audit-required for screening. |
| Regulatory action | SAR/STR/escalation reference | `P2_RESTRICTED_COMPLIANCE` | Extremely restricted; do not expose in general UI. |

## 12. Sanctions and watchlist screening fields

| Field | Class | Description |
|---|---|---|
| `screening_run_id` | `P2_RESTRICTED_COMPLIANCE` | Stable run ID. |
| `screened_party_id` | `P2_RESTRICTED_COMPLIANCE` | UOK party. |
| `list_provider` | `P2_RESTRICTED_COMPLIANCE` | OFAC, UN, EU, OpenSanctions, commercial provider, etc. |
| `list_program` | `P2_RESTRICTED_COMPLIANCE` | Sanctions program or list family. |
| `matched_entity_id` | `P2_RESTRICTED_COMPLIANCE` | Provider/list entity ID. |
| `matched_schema` | `P2_RESTRICTED_COMPLIANCE` | Person, company, vessel, aircraft, crypto wallet, address, security, etc. |
| `matched_names` | `P2_RESTRICTED_COMPLIANCE` | Exact/alias/transliteration matched names. |
| `matched_identifiers` | `P2_RESTRICTED_COMPLIANCE` | Passport, national ID, registry, LEI, tax ID, vessel IMO, wallet, etc. |
| `matched_dates` | `P2_RESTRICTED_COMPLIANCE` | DOB, incorporation, listing/start/end dates. |
| `matched_addresses` | `P2_RESTRICTED_COMPLIANCE` | Address/country matches. |
| `match_score` | `P2_RESTRICTED_COMPLIANCE` | Numeric score. |
| `match_explanation` | `P2_RESTRICTED_COMPLIANCE` | Which fields matched and why. |
| `topics` | `P2_RESTRICTED_COMPLIANCE` | Sanctioned, PEP, RCA, crime, debarred, wanted, etc. |
| `first_seen`/`last_seen` | `P2_RESTRICTED_COMPLIANCE` | Watchlist observation timestamps. |
| `review_disposition` | `P2_RESTRICTED_COMPLIANCE` | True hit, false positive, unresolved, escalated. |
| `reviewer`/`reviewed_at` | `P2_RESTRICTED_COMPLIANCE` | Audit trail. |
| `review_notes` | `P2_RESTRICTED_COMPLIANCE` | Controlled notes. |

## 13. Fraud and scam risk signal catalogue

UOK should distinguish between `risk signals` and `confirmed fraud`. A signal is not proof. Each signal needs evidence, severity, confidence, and disposition.

| Signal family | Data points | Typical interpretation |
|---|---|---|
| Identity mismatch | Legal name mismatch, bank beneficiary mismatch, domain mismatch, address mismatch, registry mismatch. | High-risk when combined with payment or onboarding activity. |
| Contact volatility | Recent phone/email/domain/address changes; new domain; deleted website; temporary email; VoIP-only. | Indicates takeover, shell, or impersonation risk. |
| Shared artifacts | Same phone/email/address/domain/bank account/device/IP across many unrelated parties. | Could indicate common office or fraud ring; requires context. |
| BEC/payment change | New bank instructions, urgent payment request, email forwarding, altered invoice, reply-to mismatch. | Requires out-of-band verification before payment. |
| Impersonation | Lookalike name/domain, spoofed caller ID, claimed government/bank/vendor identity, fake charity. | Scam risk; verify through trusted channel. |
| Payment method pressure | Crypto, wire, payment app, gift card, fake check/refund request. | Strong consumer/business scam pattern. |
| Fake invoice/procurement | Invoice for unordered product/service, vendor not in registry, unusual remittance beneficiary. | Business scam/procurement fraud risk. |
| Ownership opacity | Nominees, offshore layers, bearer shares, threshold splitting, hidden control person. | AML/KYC escalation. |
| Geographic anomaly | Country mismatch among registry, website, bank, phone, IP, shipment, operations. | Potential shell/sanctions evasion/scam. |
| Activity anomaly | Expected activity mismatch, high velocity, structuring, rapid counterparties, circular payments. | AML/fraud monitoring once transaction modules exist. |
| Adverse media | Fraud, corruption, sanctions evasion, trafficking, tax evasion, cybercrime, regulatory action. | Requires source/reliability assessment and human review. |
| Watchlist hit | Sanctions/PEP/RCA/debarment/enforcement. | Requires match disposition and escalation rules. |

## 14. Adverse media taxonomy

| Topic | Include when report says | Suggested severity basis |
|---|---|---|
| Fraud/scam | Fraud, scam, theft, deception, fake invoice, identity theft. | Source reliability, recency, court/regulator confirmation, direct involvement. |
| Money laundering | Laundering, proceeds of crime, suspicious transactions. | Law enforcement/regulator/court sources highest. |
| Sanctions evasion | Export controls, blocked parties, embargo circumvention. | Sanctions authority/court/regulatory sources highest. |
| Bribery/corruption | Bribes, kickbacks, public corruption. | Government/regulator/court sources highest. |
| Terrorist financing | Financing or material support allegations. | Authority source and match quality critical. |
| Cybercrime | BEC, ransomware, phishing, malware, data theft. | Confirmed indictments/regulator notices high. |
| Tax evasion | Evasion, abusive schemes, illegal avoidance. | Tax authority/court sources high. |
| Human rights/labor | Forced labor, child labor, trafficking, severe labor abuse. | NGO/regulator/media corroboration. |
| Regulatory enforcement | Fines, licenses revoked, debarment, consent orders. | Official regulator source high. |
| Insolvency/litigation | Bankruptcy, insolvency, lawsuits, judgments. | Court/public records high; mere allegations lower. |

## 15. Evidence object for every normalized fact

Every normalized fact should be able to point to evidence like this:

```json
{
  "fact_id": "fact_...",
  "party_id": "party_...",
  "field_path": "emails[0].email",
  "value_hash": "sha256:...",
  "source": {
    "provider": "registry_or_enrichment_provider",
    "dataset": "company_registry",
    "source_record_id": "...",
    "source_url": "https://...",
    "captured_at": "2026-07-07T00:00:00Z",
    "first_seen": "2025-01-01",
    "last_seen": "2026-07-07",
    "num_sources": 2,
    "confidence": "high",
    "terms": {"allowed_use": "business_due_diligence"}
  },
  "review": {
    "status": "unreviewed",
    "reviewer_user_id": null,
    "reviewed_at": null,
    "disposition": null
  }
}
```

## 16. Recommended future normalized tables

| Table | Purpose |
|---|---|
| `party_aliases` | Multi-valued names, aliases, previous names, transliterations, active dates, source evidence. |
| `party_contact_points` | Emails, phones, websites, social profiles, payment handles, contact preferences, first/last seen. |
| `party_locations` | Registered, HQ, branch, mailing, billing, residential, historical addresses. |
| `party_identifiers` | Registry IDs, LEI, D-U-N-S, CIK, ticker, tax IDs, provider IDs, hashed restricted identifiers. |
| `party_roles` | Employment, officer, director, beneficial owner, control person, advisor, stakeholder relationships. |
| `party_ownership_edges` | Parent/subsidiary/affiliate/beneficial ownership graph with percentages and dates. |
| `party_screening_runs` | Sanctions/PEP/adverse-media screening run metadata. |
| `party_screening_hits` | Candidate watchlist/adverse-media hits and review disposition. |
| `party_risk_signals` | Fraud/scam/AML risk signals with severity, confidence, and evidence. |
| `party_evidence` | Generic evidence records for all normalized facts. |
| `party_risk_reviews` | Human review decisions, risk tier changes, escalation notes, next review date. |

## 17. UOK implementation rules

1. **Never collapse multi-valued data into a single field.** Use arrays in JSON for the first release and normalized rows later.
2. **Never treat an alias, shared address, or shared phone as fraud by itself.** It is a signal requiring context and disposition.
3. **Separate business profile from restricted compliance profile.** General Contacts users should not see sensitive KYC artifacts by default.
4. **Keep provider payloads out of contact records.** Store normalized facts, source metadata, and optional payload hashes only.
5. **Use confidence and source count everywhere.** Reports should explain what was observed, by whom, when, and how reliable it is.
6. **Screen with audit trails.** Every sanctions/PEP/adverse-media hit must have match reason, reviewer, disposition, and timestamp.
7. **Model beneficial ownership as a graph.** Store direct/indirect ownership, percentages, control basis, and dates.
8. **Create review queues for unresolved risk.** Low-confidence, conflicting, or high-severity facts should not silently merge.
9. **Make refresh cadence risk-based.** Higher-risk contacts need shorter review intervals.
10. **Do not provide credit/consumer eligibility decisions from this profile without separate legal review.** Credit-reporting and consumer-reporting regimes can impose separate requirements.

## 18. First-release schema extension recommendation

The existing `ContactBusinessProfile` can remain lightweight, but future iterations should add these nested sections or compatible normalized tables:

```json
{
  "aliases": [],
  "contact_points": [],
  "identifiers": [],
  "locations": [],
  "relationships": [],
  "risk": {
    "risk_tier": "unknown",
    "risk_scores": {},
    "risk_signals": [],
    "screening_summary": {
      "sanctions": "not_screened",
      "pep": "not_screened",
      "adverse_media": "not_screened",
      "fraud": "not_screened"
    },
    "review_status": "not_reviewed",
    "next_review_at": null
  }
}
```

## 19. Source references

- People Data Labs Person Enrichment and Person Schema: https://docs.peopledatalabs.com/docs/person-enrichment-api and https://docs.peopledatalabs.com/docs/person-schema
- People Data Labs Company Schema: https://docs.peopledatalabs.com/docs/company-schema
- OpenCorporates API reference: https://api.opencorporates.com/documentation/API-Reference
- GLEIF Legal Entity Identifier overview: https://www.gleif.org/en/organizational-identity/lei-vlei/the-legal-entity-identifier-lei
- FATF Recommendations: https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html
- FFIEC BSA/AML Beneficial Ownership Requirements: https://bsaaml.ffiec.gov/manual/AssessingComplianceWithBSARegulatoryRequirements/03
- OpenSanctions FollowTheMoney model documentation: https://www.opensanctions.org/docs/entities/
- FBI IC3 Business Email Compromise guidance: https://www.ic3.gov/CrimeInfo/BEC
- FTC scam guidance: https://consumer.ftc.gov/articles/how-avoid-scam
- FTC small-business scam guidance: https://consumer.ftc.gov/articles/scams-against-small-businesses
- Dun & Bradstreet business intelligence/report concepts: https://www.dnb.com/business-directory.html

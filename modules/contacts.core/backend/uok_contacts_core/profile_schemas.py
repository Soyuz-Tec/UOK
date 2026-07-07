from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

PROFILE_ATTR_KEY = "business_profile"
PROFILE_EVIDENCE_ATTR_KEY = "business_profile_evidence"
PROFILE_SCHEMA_VERSION = "2026-07-07"

MAX_PROFILE_SUMMARY_LENGTH = 1600
MAX_PROFILE_TAG_LENGTH = 80
MAX_PROFILE_LIST_ITEMS = 40
MAX_PROFILE_EVIDENCE_ITEMS = 50
MAX_PROFILE_TEXT_LENGTH = 320

ConfidenceLevel = Literal["unknown", "low", "medium", "high", "verified"]
PartyProfileType = Literal["person", "organization", "unknown"]


class ProfileSource(BaseModel):
    provider: str = Field(..., min_length=1, max_length=80)
    source_type: str = Field(default="manual", max_length=80)
    source_record_id: str | None = Field(default=None, max_length=160)
    source_url: str | None = Field(default=None, max_length=500)
    captured_at: str | None = Field(default=None, max_length=80)
    confidence: ConfidenceLevel = "medium"
    fields: list[str] = Field(default_factory=list)
    terms: dict[str, Any] = Field(default_factory=dict)


class PersonIntelligence(BaseModel):
    current_title: str | None = Field(default=None, max_length=MAX_PROFILE_TEXT_LENGTH)
    current_company: str | None = Field(default=None, max_length=MAX_PROFILE_TEXT_LENGTH)
    seniority: str | None = Field(default=None, max_length=120)
    department: str | None = Field(default=None, max_length=120)
    decision_role: str | None = Field(default=None, max_length=120)
    professional_summary: str | None = Field(default=None, max_length=MAX_PROFILE_SUMMARY_LENGTH)
    locations: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    social_profiles: dict[str, str] = Field(default_factory=dict)


class OrganizationIntelligence(BaseModel):
    legal_name: str | None = Field(default=None, max_length=MAX_PROFILE_TEXT_LENGTH)
    domains: list[str] = Field(default_factory=list)
    industries: list[str] = Field(default_factory=list)
    size_range: str | None = Field(default=None, max_length=120)
    revenue_range: str | None = Field(default=None, max_length=120)
    headquarters: str | None = Field(default=None, max_length=MAX_PROFILE_TEXT_LENGTH)
    locations: list[str] = Field(default_factory=list)
    funding_stage: str | None = Field(default=None, max_length=120)
    last_funding_round: str | None = Field(default=None, max_length=MAX_PROFILE_TEXT_LENGTH)
    technologies: list[str] = Field(default_factory=list)
    competitors: list[str] = Field(default_factory=list)


class RelationshipIntelligence(BaseModel):
    owner_user_id: str | None = Field(default=None, max_length=80)
    stakeholder_role: str | None = Field(default=None, max_length=120)
    relationship_stage: str | None = Field(default=None, max_length=120)
    relationship_strength: str | None = Field(default=None, max_length=80)
    priority: str | None = Field(default=None, max_length=80)
    sentiment: str | None = Field(default=None, max_length=80)
    last_interaction_at: str | None = Field(default=None, max_length=80)
    next_step: str | None = Field(default=None, max_length=MAX_PROFILE_TEXT_LENGTH)


class ProfileGovernance(BaseModel):
    allowed_uses: list[str] = Field(default_factory=lambda: ["relationship_management", "business_development"])
    consent_basis: str | None = Field(default=None, max_length=160)
    retention_hint: str | None = Field(default=None, max_length=160)
    do_not_enrich: bool = False
    sensitive_fields_excluded: bool = True


class ContactBusinessProfile(BaseModel):
    schema_version: str = PROFILE_SCHEMA_VERSION
    profile_type: PartyProfileType = "unknown"
    generated_by: str = Field(default="contacts.core", max_length=80)
    updated_at: str | None = Field(default=None, max_length=80)
    summary: str = Field(default="", max_length=MAX_PROFILE_SUMMARY_LENGTH)
    tags: list[str] = Field(default_factory=list)
    person: PersonIntelligence = Field(default_factory=PersonIntelligence)
    organization: OrganizationIntelligence = Field(default_factory=OrganizationIntelligence)
    relationship: RelationshipIntelligence = Field(default_factory=RelationshipIntelligence)
    governance: ProfileGovernance = Field(default_factory=ProfileGovernance)
    scores: dict[str, int] = Field(default_factory=dict)
    confidence: ConfidenceLevel = "unknown"
    risk_flags: list[str] = Field(default_factory=list)
    sources: list[ProfileSource] = Field(default_factory=list)


class ContactProfileWriteRequest(BaseModel):
    summary: str | None = Field(default=None, max_length=MAX_PROFILE_SUMMARY_LENGTH)
    tags: list[str] | None = None
    person: PersonIntelligence | None = None
    organization: OrganizationIntelligence | None = None
    relationship: RelationshipIntelligence | None = None
    governance: ProfileGovernance | None = None
    scores: dict[str, int] | None = None
    confidence: ConfidenceLevel | None = None
    risk_flags: list[str] | None = None
    source: ProfileSource | None = None


class ContactProfileEvidenceRequest(BaseModel):
    source: ProfileSource
    normalized_facts: dict[str, Any] = Field(default_factory=dict)
    merge_into_profile: bool = True


class ContactProfileRebuildRequest(BaseModel):
    include_notes: bool = True
    include_relationships: bool = True
    source: ProfileSource | None = None

import { formatLabel } from "../../shared/format";
import { DetailItem, EmptyState, MetricGrid, StatusPill } from "../../shared/data-display";
import type { ContactRecord } from "../../shared/types";
import { deriveContactBusinessIntelligenceProfile, profileRiskTone, profileTone } from "./contactBusinessIntelligenceProfileModel";

export function ContactBusinessIntelligenceProfilePanel({ contact }: { contact: ContactRecord }) {
  const profile = contact.business_intelligence_profile || deriveContactBusinessIntelligenceProfile(contact);

  return (
    <section className="detail-section pane-section contact-business-intelligence" aria-label="Business intelligence profile">
      <div className="contact-business-intelligence-summary">
        <StatusPill label={profile.headline} tone={profileTone(profile.readiness)} />
        <p>{profile.summary}</p>
      </div>
      <div className="detail-grid contact-business-intelligence-grid">
        <DetailItem label="Type" value={formatLabel(profile.profile_type)} />
        <DetailItem label="Confidence" value={formatLabel(profile.confidence)} />
        <DetailItem label="Readiness" value={formatLabel(profile.readiness)} />
        <DetailItem label="Signals" value={String(profile.signal_count)} />
        <DetailItem label="Facts" value={String(profile.fact_count)} />
        <DetailItem label="Notes" value={String(profile.note_count)} />
        <DetailItem label="Relationships" value={String(profile.relationship_count)} />
        <DetailItem label="Groups" value={String(profile.group_count)} />
        <DetailItem label="Business domain groups" value={String(profile.business_domain_group_count)} />
        <DetailItem label="Duplicate cues" value={String(profile.duplicate_candidate_count)} />
        <DetailItem label="Updated" value={profile.updated_at || "Derived from current contact data"} />
        {profile.primary_organization_name ? <DetailItem label="Primary organization" value={profile.primary_organization_name} /> : null}
      </div>

      <MetricGrid
        counts={{
          facts: profile.fact_count,
          notes: profile.note_count,
          relationships: profile.relationship_count,
          groups: profile.group_count,
          "business domain groups": profile.business_domain_group_count,
          "duplicate cues": profile.duplicate_candidate_count
        }}
      />

      {profile.tags.length ? (
        <div className="contact-business-intelligence-tags" aria-label="Profile tags">
          {profile.tags.map((tag) => (
            <span className="contact-business-intelligence-tag" key={tag}>
              {formatLabel(tag)}
            </span>
          ))}
        </div>
      ) : (
        <EmptyState text="No intelligence tags yet." />
      )}

      {profile.risk_flags.length ? (
        <div className="contact-business-intelligence-risks" aria-label="Profile risk flags">
          <strong>Risk flags</strong>
          <div className="contact-business-intelligence-chip-row">
            {profile.risk_flags.map((flag) => (
              <StatusPill key={flag} label={formatLabel(flag)} tone={profileRiskTone(flag)} />
            ))}
          </div>
        </div>
      ) : null}

      {profile.recent_note ? (
        <div className="contact-business-intelligence-note">
          <strong>Latest note</strong>
          <p>{profile.recent_note}</p>
        </div>
      ) : null}

      {profile.group_names.length ? (
        <div className="contact-business-intelligence-list">
          <strong>Groups</strong>
          <p>{profile.group_names.join(", ")}</p>
        </div>
      ) : null}

      {profile.relationship_names.length ? (
        <div className="contact-business-intelligence-list">
          <strong>Related parties</strong>
          <p>{profile.relationship_names.join(", ")}</p>
        </div>
      ) : null}
    </section>
  );
}

import { formatLabel } from "../../shared/format";
import { DetailItem, EmptyState, MetricGrid, StatusPill } from "../../shared/data-display";
import type { ContactBusinessIntelligenceProfile, ContactRecord } from "../../shared/types";

const WARNING_READINESS = new Set(["needs_review", "possible_duplicate", "incomplete"]);

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
              <StatusPill key={flag} label={formatLabel(flag)} tone={WARNING_READINESS.has(flag) ? "warning" : "info"} />
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

function deriveContactBusinessIntelligenceProfile(contact: ContactRecord): ContactBusinessIntelligenceProfile {
  const noteCount = contact.notes?.length || 0;
  const relationshipCount = contact.relationships?.length || 0;
  const groupCount = contact.groups?.length || 0;
  const businessDomainGroupCount = (contact.groups || []).filter((group) => group.kind === "business_domain").length;
  const duplicateCandidateCount = contact.duplicate_candidates?.length || 0;
  const factCount = contactFactCount(contact);
  const imported = ["csv_import", "gmail", "email"].includes(contact.source);
  const readiness = contactReadiness(contact.status, contact.review_state, factCount, duplicateCandidateCount);
  const confidence = contactConfidence(contact.status, contact.review_state, factCount, noteCount, relationshipCount, groupCount, duplicateCandidateCount);

  return {
    profile_type: contact.party_type === "person" || contact.party_type === "organization" ? contact.party_type : "unknown",
    headline: profileHeadline(readiness),
    summary: profileSummary(contact, factCount, noteCount, relationshipCount, groupCount, duplicateCandidateCount, imported),
    confidence,
    readiness,
    signal_count: 1 + noteCount + relationshipCount + groupCount + duplicateCandidateCount + (imported ? 1 : 0),
    fact_count: factCount,
    note_count: noteCount,
    relationship_count: relationshipCount,
    group_count: groupCount,
    business_domain_group_count: businessDomainGroupCount,
    duplicate_candidate_count: duplicateCandidateCount,
    primary_organization_name: contactPrimaryOrganizationName(contact),
    recent_note: contact.notes?.[0]?.body || "",
    updated_at: contact.updated_at,
    tags: uniqueValues([
      contact.party_type,
      contact.review_state,
      imported ? "imported" : "",
      duplicateCandidateCount ? "duplicate_candidate" : "",
      relationshipCount ? "relationship_linked" : "",
      groupCount ? "grouped" : "",
      businessDomainGroupCount ? "business_domain_grouped" : ""
    ]),
    risk_flags: uniqueValues([
      contact.status === "archived" ? "archived" : "",
      contact.status === "purged" ? "purged" : "",
      contact.review_state === "possible_duplicate" || duplicateCandidateCount ? "possible_duplicate" : "",
      contact.review_state === "needs_review" ? "needs_review" : "",
      contact.review_state === "incomplete" || factCount < 2 ? "incomplete" : ""
    ]),
    group_names: uniqueValues((contact.groups || []).map((group) => group.name)),
    relationship_names: uniqueValues((contact.relationships || []).map((relationship) => relationship.related_party_name || "")),
  };
}

function contactFactCount(contact: ContactRecord) {
  return [contact.email, contact.phone, contact.website, contact.address, contact.organization_name, contact.title].filter(Boolean).length + (contact.display_name ? 1 : 0);
}

function contactReadiness(status: string, reviewState: string, factCount: number, duplicateCandidateCount: number) {
  if (status === "purged") return "purged";
  if (status === "archived") return "archived";
  if (reviewState === "possible_duplicate" || duplicateCandidateCount) return "possible_duplicate";
  if (reviewState === "needs_review" || reviewState === "incomplete") return reviewState;
  if (factCount < 2) return "incomplete";
  return "ready";
}

function profileHeadline(readiness: ContactBusinessIntelligenceProfile["readiness"]) {
  return {
    ready: "Ready contact",
    needs_review: "Needs review",
    possible_duplicate: "Possible duplicate",
    incomplete: "Incomplete contact",
    archived: "Archived contact",
    purged: "Purged contact"
  }[readiness] || "Contact profile";
}

function profileTone(readiness: ContactBusinessIntelligenceProfile["readiness"]): "success" | "warning" | "danger" | "info" {
  if (readiness === "ready") return "success";
  if (readiness === "archived" || readiness === "purged") return "info";
  return "warning";
}

function contactConfidence(
  status: string,
  reviewState: string,
  factCount: number,
  noteCount: number,
  relationshipCount: number,
  groupCount: number,
  duplicateCandidateCount: number
): ContactBusinessIntelligenceProfile["confidence"] {
  if (status === "archived" || status === "purged" || reviewState === "possible_duplicate" || duplicateCandidateCount) return "low";
  if (reviewState === "needs_review" || reviewState === "incomplete") return "medium";
  if (factCount >= 4 && noteCount + relationshipCount + groupCount >= 1) return "high";
  if (factCount >= 2) return "medium";
  return "low";
}

function profileSummary(
  contact: ContactRecord,
  factCount: number,
  noteCount: number,
  relationshipCount: number,
  groupCount: number,
  duplicateCandidateCount: number,
  imported: boolean
) {
  if (contact.status === "purged") {
    return "This contact has been purged.";
  }
  if (contact.status === "archived") {
    return "This contact is archived.";
  }
  if (duplicateCandidateCount) {
    return "This record has duplicate signals that should be reviewed.";
  }
  if (imported && contact.review_state !== "ready") {
    return "Imported contact awaiting review.";
  }
  if (contact.review_state === "needs_review") {
    return "This contact is waiting for review before it is fully trusted.";
  }
  if (contact.review_state === "incomplete" || factCount < 2) {
    return "Add another meaningful fact before relying on this record.";
  }
  const pieces = [`${factCount} contact facts`];
  if (noteCount) pieces.push(`${noteCount} notes`);
  if (relationshipCount) pieces.push(`${relationshipCount} relationships`);
  if (groupCount) pieces.push(`${groupCount} groups`);
  return `Ready contact with ${pieces.join(", ")}.`;
}

function contactPrimaryOrganizationName(contact: ContactRecord) {
  if (contact.party_type === "organization") {
    return contact.organization_name || contact.display_name || "";
  }
  const worksFor = (contact.relationships || []).find((relationship) => relationship.relationship_type === "works_for" && relationship.related_party_name);
  return worksFor?.related_party_name || contact.organization_name || "";
}

function uniqueValues(values: Array<string | undefined | null>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = String(value || "").trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

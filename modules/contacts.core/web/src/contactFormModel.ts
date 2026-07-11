import { Building2, CalendarDays, FileText, MessageCircle, ShieldCheck, UserRound } from "lucide-react";

import type { ContactDraft } from "@uok/shared/types";

export type AddableSection = "person" | "organization" | "dates" | "messaging" | "source" | "more";

export const addableSections: Array<{ id: AddableSection; label: string; description: string; icon: typeof UserRound }> = [
  { id: "person", label: "Person details", description: "Given and family name", icon: UserRound },
  { id: "organization", label: "Organization details", description: "Company, title, and team", icon: Building2 },
  { id: "dates", label: "Dates", description: "Birthday and important date", icon: CalendarDays },
  { id: "messaging", label: "Messaging and tags", description: "Instant message and tags", icon: MessageCircle },
  { id: "source", label: "Governance details", description: "Source, consent, and allowed use", icon: ShieldCheck },
  { id: "more", label: "More details", description: "Website, address, and note", icon: FileText }
];

export function contactDraftSectionState(draft: ContactDraft, addedSections: Record<AddableSection, boolean>) {
  const hasPersonDetails = [draft.given_name, draft.family_name].some(hasText);
  const hasOrganizationDetails = [draft.organization_name, draft.company_name, draft.title, draft.team_id].some(hasText);
  const hasDateDetails = [draft.birthday, draft.important_date].some(hasText);
  const hasMessagingDetails = [draft.instant_message, draft.tags].some(hasText);
  const hasSourceDetails = [draft.source, draft.client_reference, draft.consent_status, draft.allowed_use, draft.confidence_level].some(hasText);
  const hasMoreContactDetails = [draft.website, draft.address, draft.note].some(hasText);
  const visibleSections = {
    person: addedSections.person || hasPersonDetails,
    organization: addedSections.organization || hasOrganizationDetails,
    dates: addedSections.dates || hasDateDetails,
    messaging: addedSections.messaging || hasMessagingDetails,
    source: addedSections.source || hasSourceDetails,
    more: addedSections.more || hasMoreContactDetails
  };
  return {
    visibleSections,
    availableSections: addableSections.filter((section) => !visibleSections[section.id])
  };
}

export function contactDraftHasMeaningfulValue(draft: ContactDraft) {
  return [
    draft.display_name,
    draft.given_name,
    draft.family_name,
    draft.organization_name,
    draft.company_name,
    draft.email,
    draft.phone,
    draft.website,
    draft.address,
    draft.title,
    draft.birthday,
    draft.important_date,
    draft.instant_message,
    draft.tags,
    draft.consent_status,
    draft.allowed_use,
    draft.confidence_level,
    draft.note
  ].some(hasText);
}

export function isValidWebsite(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return Boolean(url.hostname.includes("."));
  } catch {
    return false;
  }
}

function hasText(value: string) {
  return value.trim().length > 0;
}

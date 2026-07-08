import type { ContactDraft, ContactRecord } from "../shared/types";

export function draftFromContact(contact: ContactRecord): ContactDraft {
  return {
    party_type: contact.party_type === "organization" ? "organization" : "person",
    display_name: contact.display_name || "",
    given_name: contact.given_name || "",
    family_name: contact.family_name || "",
    organization_name: contact.organization_name || "",
    company_name: "",
    email: contact.email || "",
    phone: contact.phone || "",
    website: contact.website || "",
    address: contact.address || "",
    title: contact.title || "",
    birthday: contact.birthday || "",
    important_date: contact.important_date || "",
    instant_message: contact.instant_message || "",
    tags: contact.tags || "",
    note: "",
    source: contact.source || "",
    client_reference: contact.client_reference || "",
    team_id: contact.team_id || ""
  };
}

export function nonEmptyDraftPayload(draft: ContactDraft) {
  return Object.fromEntries(Object.entries(draft).filter(([, value]) => String(value || "").trim() !== ""));
}

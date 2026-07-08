import type { ContactRecord } from "../../shared/types";

export type ContactQualityIssueId =
  | "possible_duplicate"
  | "email_only"
  | "needs_name"
  | "missing_company"
  | "missing_purpose"
  | "imported_review"
  | "incomplete"
  | "ready";

export type ContactQualityGroup = {
  id: ContactQualityIssueId;
  title: string;
  description: string;
  contacts: ContactRecord[];
};

export const contactQualityIssueOrder: ContactQualityIssueId[] = [
  "possible_duplicate",
  "email_only",
  "needs_name",
  "missing_company",
  "missing_purpose",
  "imported_review",
  "incomplete",
  "ready"
];

const qualityCopy: Record<ContactQualityIssueId, { title: string; description: string }> = {
  possible_duplicate: {
    title: "Possible duplicates",
    description: "Compare before using these contacts in a transaction."
  },
  email_only: {
    title: "Email-only contacts",
    description: "Add a real name, organization, or purpose before using these records."
  },
  needs_name: {
    title: "Needs a better name",
    description: "Replace email-only or placeholder names with a real person or organization name."
  },
  missing_company: {
    title: "Missing company",
    description: "Add the company or role for business contacts so relationships stay clear."
  },
  missing_purpose: {
    title: "Needs purpose note",
    description: "Add why this contact exists before relying on it later."
  },
  imported_review: {
    title: "Imported for review",
    description: "Confirm imported details and mark ready when the record is useful."
  },
  incomplete: {
    title: "Incomplete",
    description: "Add enough detail to make the contact searchable and actionable."
  },
  ready: {
    title: "Ready",
    description: "Usable records with no immediate cleanup signal."
  }
};

export function contactPrimaryQualityIssue(contact: ContactRecord): ContactQualityIssueId {
  if ((contact.duplicate_candidates || []).length || contact.review_state === "possible_duplicate") return "possible_duplicate";
  if (isEmailOnlyContact(contact)) return "email_only";
  if (looksLikePlaceholderName(contact)) return "needs_name";
  if (needsCompany(contact)) return "missing_company";
  if (needsPurposeNote(contact)) return "missing_purpose";
  if (contact.review_state === "needs_review" || contact.source === "csv_import") return "imported_review";
  if (contact.review_state === "incomplete" || contactFactCount(contact) < 2) return "incomplete";
  return "ready";
}

export function contactQualityGroups(contacts: ContactRecord[]): ContactQualityGroup[] {
  const grouped = new Map<ContactQualityIssueId, ContactRecord[]>();
  for (const id of contactQualityIssueOrder) grouped.set(id, []);
  for (const contact of contacts) {
    grouped.get(contactPrimaryQualityIssue(contact))?.push(contact);
  }
  return contactQualityIssueOrder.map((id) => ({
    id,
    ...qualityCopy[id],
    contacts: grouped.get(id) || []
  }));
}

export function contactQualityActions(contact: ContactRecord) {
  const issue = contactPrimaryQualityIssue(contact);
  if (issue === "possible_duplicate") return ["Compare duplicate records", "Keep the best contact facts", "Mark ready after review"];
  if (issue === "email_only") return ["Add a person or organization name", "Confirm why this email is useful", "Mark ready after review"];
  if (issue === "needs_name") return ["Edit the display name", "Add person or organization details", "Mark ready after review"];
  if (issue === "missing_company") return ["Add company or organization", "Link the related company if it already exists", "Mark ready after review"];
  if (issue === "missing_purpose") return ["Add a short purpose note", "Confirm source and relationship", "Mark ready after review"];
  if (issue === "imported_review") return ["Confirm imported fields", "Add a purpose note if needed", "Mark ready"];
  if (issue === "incomplete") return ["Add one contact method", "Add organization or address", "Mark ready after review"];
  return ["Use this contact in normal workflows", "Keep details updated when new evidence appears"];
}

export function duplicateMatches(contact: ContactRecord, contacts: ContactRecord[]) {
  const explicitIds = new Set((contact.duplicate_candidates || []).map((candidate) => candidate.id));
  const normalizedEmail = normalize(contact.email);
  const normalizedPhone = normalize(contact.phone);
  const normalizedName = normalize(contact.display_name);
  return contacts.filter((candidate) => {
    if (candidate.id === contact.id) return false;
    if (explicitIds.has(candidate.id)) return true;
    return Boolean(
      (normalizedEmail && normalize(candidate.email) === normalizedEmail) ||
      (normalizedPhone && normalize(candidate.phone) === normalizedPhone) ||
      (normalizedName && normalize(candidate.display_name) === normalizedName)
    );
  });
}

function looksLikePlaceholderName(contact: ContactRecord) {
  const name = contact.display_name.trim().toLowerCase();
  return Boolean(
    !name ||
    name === normalize(contact.email) ||
    name === normalize(contact.phone) ||
    name === normalize(contact.website) ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(name)
  );
}

function isEmailOnlyContact(contact: ContactRecord) {
  const email = normalize(contact.email);
  if (!email) return false;
  const name = normalize(contact.display_name);
  const hasOtherFact = Boolean(contact.phone || contact.website || contact.address || contact.organization_name || contact.title);
  return !hasOtherFact && (!name || name === email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(name));
}

function needsCompany(contact: ContactRecord) {
  if (contact.party_type !== "person") return false;
  if (contact.organization_name || contact.title) return false;
  const emailDomain = normalize(contact.email).split("@")[1] || "";
  return Boolean(emailDomain && !publicEmailDomains.has(emailDomain));
}

function needsPurposeNote(contact: ContactRecord) {
  const imported = contact.source === "csv_import" || contact.source === "gmail" || contact.source === "email";
  const hasPurposeSignal = Boolean(contact.organization_name || contact.title || contact.address || contact.website);
  return imported && !hasPurposeSignal;
}

function contactFactCount(contact: ContactRecord) {
  return [contact.email, contact.phone, contact.website, contact.address, contact.organization_name, contact.title].filter(Boolean).length;
}

function normalize(value?: string) {
  return String(value || "").trim().toLowerCase();
}

const publicEmailDomains = new Set([
  "gmail.com",
  "googlemail.com",
  "icloud.com",
  "me.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "aol.com",
  "proton.me",
  "protonmail.com"
]);

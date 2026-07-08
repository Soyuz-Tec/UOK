import { formatLabel } from "../../shared/format";
import type { ContactRecord } from "../../shared/types";

export type StatusTone = "success" | "warning" | "danger" | "info";
export type ContactFactKind = "email" | "phone" | "website" | "address" | "organization" | "governance";

export type ContactFact = {
  kind: ContactFactKind;
  label: string;
  value: string;
};

export function contactInitial(name: string) {
  return (name.trim().slice(0, 1) || "?").toUpperCase();
}

export function contactSubtitle(contact: ContactRecord) {
  return formatLabel(contact.party_type);
}

export function contactListIdentity(contact: ContactRecord) {
  const organization = contact.organization_name?.trim();
  if (organization && organization.toLowerCase() !== contact.display_name.trim().toLowerCase()) {
    return organization;
  }

  return contact.title?.trim() || "";
}

export function contactFacts(contact: ContactRecord): ContactFact[] {
  const organization = [contact.title, contact.organization_name].filter(Boolean).join(", ");
  const governance = [
    contact.allowed_use ? `Use: ${formatLabel(contact.allowed_use)}` : "",
    contact.consent_status ? `Consent: ${formatLabel(contact.consent_status)}` : "",
    contact.confidence_level ? `Confidence: ${formatLabel(contact.confidence_level)}` : ""
  ].filter(Boolean).join(" | ");
  return [
    contact.phone ? { kind: "phone", label: "Phone", value: contact.phone } : undefined,
    contact.email ? { kind: "email", label: "Email", value: contact.email } : undefined,
    contact.website ? { kind: "website", label: "Website", value: contact.website } : undefined,
    contact.address ? { kind: "address", label: "Address", value: contact.address } : undefined,
    organization ? { kind: "organization", label: "Organization", value: organization } : undefined,
    governance ? { kind: "governance", label: "Governance", value: governance } : undefined
  ].filter((fact): fact is ContactFact => Boolean(fact));
}

export function contactStatusTone(status: string): StatusTone {
  if (status === "active") return "success";
  if (status === "archived") return "warning";
  if (status === "purged") return "danger";
  return "info";
}

export function contactReviewTone(reviewState: string): StatusTone {
  if (reviewState === "ready") return "success";
  if (reviewState === "incomplete" || reviewState === "possible_duplicate" || reviewState === "needs_review") return "warning";
  return "info";
}

export function moduleStatusTone(status?: string): StatusTone {
  if (status === "installed" || status === "upgraded") return "success";
  if (status === "disabled") return "warning";
  if (status === "uninstalled") return "danger";
  return "info";
}

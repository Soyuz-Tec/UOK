import { formatDate, formatLabel } from "../../shared/format";
import type { ColumnVisibilityMap, ColumnVisibilityOption } from "../../shared/tables";
import type { ContactRecord } from "../../shared/types";

export const contactListDisplayFieldOptions: ColumnVisibilityOption[] = [
  { id: "organization", label: "Organization" },
  { id: "title", label: "Title", defaultVisible: false },
  { id: "email", label: "Email", defaultVisible: false },
  { id: "phone", label: "Phone", defaultVisible: false },
  { id: "website", label: "Website", defaultVisible: false },
  { id: "party_type", label: "Type", defaultVisible: false },
  { id: "review_state", label: "Review", defaultVisible: false },
  { id: "source", label: "Source", defaultVisible: false },
  { id: "updated_at", label: "Updated", defaultVisible: false }
];

export function contactListDisplayHeader(visibility: ColumnVisibilityMap) {
  const selected = contactListDisplayFieldOptions.filter((option) => visibility[option.id] !== false);
  if (!selected.length) return "Details";
  if (selected.length === 1) return selected[0].label;
  return selected.map((option) => option.label).join(" + ");
}

export function contactListDisplayValue(contact: ContactRecord, visibility: ColumnVisibilityMap) {
  const values = contactListDisplayFieldOptions
    .filter((option) => visibility[option.id] !== false)
    .map((option) => contactDisplayFieldValue(contact, option.id))
    .filter(Boolean);
  return values.join(" · ");
}

function contactDisplayFieldValue(contact: ContactRecord, fieldId: string) {
  switch (fieldId) {
    case "email":
      return contact.email || "";
    case "organization":
      return organizationIdentity(contact);
    case "party_type":
      return formatLabel(contact.party_type);
    case "phone":
      return contact.phone || "";
    case "review_state":
      return formatLabel(contact.review_state);
    case "source":
      return formatLabel(contact.source);
    case "title":
      return contact.title || "";
    case "updated_at":
      return formatDate(contact.updated_at);
    case "website":
      return contact.website || "";
    default:
      return "";
  }
}

function organizationIdentity(contact: ContactRecord) {
  const organization = contact.organization_name?.trim();
  if (organization && organization.toLowerCase() !== contact.display_name.trim().toLowerCase()) {
    return organization;
  }

  return "";
}

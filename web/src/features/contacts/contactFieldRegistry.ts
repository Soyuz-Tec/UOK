import { formatDate, formatLabel } from "../../shared/format";
import type { ColumnVisibilityOption } from "../../shared/tables";
import type { ContactRecord } from "../../shared/types";

export type ContactFieldId =
  | "address"
  | "created_at"
  | "email"
  | "groups"
  | "name"
  | "organization"
  | "party_type"
  | "phone"
  | "review_state"
  | "source"
  | "status"
  | "title"
  | "updated_at"
  | "website";

type ContactFieldDefinition = {
  id: ContactFieldId;
  label: string;
  defaultVisible?: boolean;
  locked?: boolean;
  value: (contact: ContactRecord) => string;
  title?: (contact: ContactRecord) => string;
};

export const contactFieldDefinitions: ContactFieldDefinition[] = [
  field("name", "Name", (contact) => contact.display_name, { locked: true }),
  field("email", "Email", (contact) => contact.email),
  field("phone", "Phone", (contact) => contact.phone),
  field("address", "Address", (contact) => contact.address),
  field("organization", "Organization", contactOrganizationIdentity),
  field("website", "Website", (contact) => contact.website, { defaultVisible: false }),
  field("title", "Title", (contact) => contact.title, { defaultVisible: false }),
  field("party_type", "Type", (contact) => formatLabel(contact.party_type), { defaultVisible: false }),
  field("status", "Status", (contact) => formatLabel(contact.status), { defaultVisible: false }),
  field("review_state", "Review", (contact) => formatLabel(contact.review_state), { defaultVisible: false }),
  field("source", "Source", (contact) => formatLabel(contact.source), { defaultVisible: false }),
  field("groups", "Groups", (contact) => contactGroupNames(contact).join(", "), { defaultVisible: false }),
  field("updated_at", "Updated", (contact) => formatDate(contact.updated_at), { defaultVisible: false }),
  field("created_at", "Created", (contact) => formatDate(contact.created_at), { defaultVisible: false })
];

export function contactFieldDefinition(fieldId: ContactFieldId) {
  return contactFieldDefinitions.find((fieldDefinition) => fieldDefinition.id === fieldId);
}

export function contactFieldLabel(fieldId: ContactFieldId) {
  return contactFieldDefinition(fieldId)?.label || "";
}

export function contactFieldValue(contact: ContactRecord, fieldId: ContactFieldId, emptyValue = "") {
  const value = contactFieldDefinition(fieldId)?.value(contact).trim() || "";
  return value || emptyValue;
}

export function contactFieldTitle(contact: ContactRecord, fieldId: ContactFieldId) {
  const definition = contactFieldDefinition(fieldId);
  const value = definition?.title?.(contact) || definition?.value(contact) || "";
  return value.trim() || undefined;
}

export function contactVisibilityOptions(fieldIds: ContactFieldId[]): ColumnVisibilityOption[] {
  return fieldIds.map((fieldId) => {
    const definition = contactFieldDefinition(fieldId);
    return {
      id: fieldId,
      label: definition?.label || fieldId,
      defaultVisible: definition?.defaultVisible,
      locked: definition?.locked
    };
  });
}

export function contactGroupNames(contact: ContactRecord) {
  return contact.groups?.map((group) => group.name).filter(Boolean) ?? [];
}

function field(
  id: ContactFieldId,
  label: string,
  value: (contact: ContactRecord) => string | undefined | null,
  options: Pick<ContactFieldDefinition, "defaultVisible" | "locked" | "title"> = {}
): ContactFieldDefinition {
  return {
    id,
    label,
    ...options,
    value: (contact) => String(value(contact) || "")
  };
}

function contactOrganizationIdentity(contact: ContactRecord) {
  const organization = contact.organization_name?.trim();
  if (organization && organization.toLowerCase() !== contact.display_name.trim().toLowerCase()) {
    return organization;
  }
  return contact.title || "";
}

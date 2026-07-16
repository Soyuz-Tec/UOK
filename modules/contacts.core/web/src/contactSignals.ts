import type { ContactRecord } from "./contracts";

const contactDataFactFields: Array<keyof ContactRecord> = [
  "email",
  "phone",
  "website",
  "address",
  "organization_name",
  "title"
];

export function contactDataFactCount(contact: ContactRecord) {
  return contactDataFactFields.filter((field) => Boolean(contact[field])).length;
}

export function contactIdentitySignalCount(contact: ContactRecord) {
  return contact.display_name ? 1 : 0;
}

export function normalizedContactText(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

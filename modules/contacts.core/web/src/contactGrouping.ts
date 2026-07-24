import { formatLabel } from "@uok/shared/format";
import type { ContactGroupBy, ContactRecord } from "./contracts";

export type ContactGroup = {
  id: string;
  label: string;
  contacts: ContactRecord[];
};

export function groupContacts(contacts: ContactRecord[], groupBy: ContactGroupBy): ContactGroup[] {
  if (groupBy === "none") {
    return [{ id: "all", label: "All contacts", contacts }];
  }
  const groups = new Map<string, ContactGroup>();
  for (const contact of contacts) {
    const key = groupValue(contact, groupBy);
    const label = `${groupLabel(groupBy)}: ${key}`;
    const id = `${groupBy}:${key}`;
    const group = groups.get(id) || { id, label, contacts: [] };
    group.contacts.push(contact);
    groups.set(id, group);
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function groupLabel(groupBy: ContactGroupBy) {
  switch (groupBy) {
    case "type":
      return "Type";
    case "review_state":
      return "Review";
    case "source":
      return "Source";
    case "organization":
      return "Organization";
    default:
      return "Group";
  }
}

function groupValue(contact: ContactRecord, groupBy: ContactGroupBy) {
  switch (groupBy) {
    case "type":
      return formatLabel(contact.party_type || "Other");
    case "review_state":
      return formatLabel(contact.review_state || "Unreviewed");
    case "source":
      return formatLabel(contact.source || "Unknown");
    case "organization":
      return contact.organization_name || contact.title || "No organization";
    default:
      return "All contacts";
  }
}

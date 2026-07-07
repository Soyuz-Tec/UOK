import { ContactCardGrid } from "./ContactCardGrid";
import { ContactList } from "./ContactList";
import { ContactsTable } from "./ContactsTable";
import type { ContactsWorkspaceProps } from "./types";

export function ContactResultsPanel({
  contacts,
  contactsView,
  selectedContactId,
  contactGroupBy,
  onSelect
}: Pick<ContactsWorkspaceProps, "contacts" | "contactsView" | "selectedContactId" | "contactGroupBy" | "onSelect">) {
  if (contactsView === "split") {
    return <ContactList contacts={contacts} selectedId={selectedContactId} groupBy={contactGroupBy} onSelect={onSelect} />;
  }

  if (contactsView === "table") {
    return <ContactsTable contacts={contacts} selectedContactId={selectedContactId} groupBy={contactGroupBy} onSelect={onSelect} />;
  }

  return <ContactCardGrid contacts={contacts} selectedContactId={selectedContactId} groupBy={contactGroupBy} onSelect={onSelect} />;
}

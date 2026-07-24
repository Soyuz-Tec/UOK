import type { ColumnVisibilityMap, DataTableColumn } from "@uok/shared/tables";
import { ContactCardGrid } from "./ContactCardGrid";
import { ContactList } from "./ContactList";
import { ContactsTable } from "./ContactsTable";
import type { ContactTableRow } from "./contactTableColumns";
import type { ContactsWorkspaceProps } from "./types";

export function ContactResultsPanel({
  contacts,
  contactsView,
  selectedContactId,
  contactGroupBy,
  listDisplayVisibility,
  tableVisibleColumns,
  onSelect
}: Pick<ContactsWorkspaceProps, "contacts" | "contactsView" | "selectedContactId" | "contactGroupBy" | "onSelect"> & {
  listDisplayVisibility: ColumnVisibilityMap;
  tableVisibleColumns: DataTableColumn<ContactTableRow>[];
}) {
  if (contactsView === "split") {
    return <ContactList contacts={contacts} selectedId={selectedContactId} groupBy={contactGroupBy} displayVisibility={listDisplayVisibility} onSelect={onSelect} />;
  }

  if (contactsView === "table") {
    return <ContactsTable contacts={contacts} selectedContactId={selectedContactId} groupBy={contactGroupBy} visibleColumns={tableVisibleColumns} onSelect={onSelect} />;
  }

  return <ContactCardGrid contacts={contacts} selectedContactId={selectedContactId} groupBy={contactGroupBy} onSelect={onSelect} />;
}

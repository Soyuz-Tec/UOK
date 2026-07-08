import { type KeyboardEvent } from "react";

import type { ContactGroupBy, ContactRecord } from "../../shared/types";
import {
  ResizableDataTable,
  type DataTableColumn,
  type DataTableSpanRow
} from "../../shared/tables";
import { ContactResultsEmptyState } from "./ContactResultState";
import { groupContacts } from "./contactGrouping";
import { type ContactTableRow } from "./contactTableColumns";

export function ContactsTable({
  contacts,
  selectedContactId,
  onSelect,
  visibleColumns,
  groupBy = "none"
}: {
  contacts: ContactRecord[];
  selectedContactId: string;
  onSelect: (id: string) => void;
  visibleColumns: DataTableColumn<ContactTableRow>[];
  groupBy?: ContactGroupBy;
}) {
  const selectFromKeyboard = (event: KeyboardEvent, contactId: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(contactId);
    }
  };

  const groups = groupContacts(contacts, groupBy);
  const rows = groups.flatMap((group) => [
    ...(groupBy !== "none" ? [{ kind: "group" as const, id: `group-${group.id}`, label: group.label }] : []),
    ...group.contacts.map((contact) => ({ kind: "contact" as const, contact }))
  ]);

  return (
    <div className="contacts-table-stack">
      <ResizableDataTable
        ariaLabel="Contact records"
        columns={visibleColumns}
        emptyState={<ContactResultsEmptyState />}
        getRowKey={(row) => row.kind === "group" ? row.id : row.contact.id}
        rowAriaLabel={(row) => row.kind === "contact" ? `Open ${row.contact.display_name}` : undefined}
        rowAriaSelected={(row) => row.kind === "contact" ? selectedContactId === row.contact.id : undefined}
        rowClassName={(row) => row.kind === "contact" && selectedContactId === row.contact.id ? "selected" : ""}
        rowTabIndex={(row) => row.kind === "contact" ? 0 : undefined}
        rows={rows}
        spanRow={contactGroupRow}
        storageKey="contacts.records"
        tableClassName="contacts-table"
        wrapperClassName="contacts-table-wrap"
        onRowClick={(row) => {
          if (row.kind === "contact") onSelect(row.contact.id);
        }}
        onRowKeyDown={(event, row) => {
          if (row.kind === "contact") selectFromKeyboard(event, row.contact.id);
        }}
      />
    </div>
  );
}

function contactGroupRow(row: ContactTableRow): DataTableSpanRow | null {
  return row.kind === "group" ? { className: "contacts-table-group-row", content: row.label } : null;
}

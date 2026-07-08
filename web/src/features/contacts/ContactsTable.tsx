import { PanelRightOpen } from "lucide-react";
import { useMemo, type KeyboardEvent } from "react";

import type { ContactGroupBy, ContactRecord } from "../../shared/types";
import { ResizableDataTable, type DataTableColumn, type DataTableSpanRow } from "../../shared/tables";
import { ContactResultsEmptyState } from "./ContactResultState";
import { groupContacts } from "./contactGrouping";
import { contactInitial } from "./contactPresentation";

type ContactTableRow =
  | { kind: "group"; id: string; label: string }
  | { kind: "contact"; contact: ContactRecord };

function contactColumns(onSelect: (id: string) => void): DataTableColumn<ContactTableRow>[] {
  return [
    {
      id: "initial",
      header: <span className="visually-hidden">Initial</span>,
      defaultWidth: 52,
      minWidth: 44,
      maxWidth: 64,
      resizable: false,
      cellClassName: "initial-cell",
      renderCell: (row) => row.kind === "contact" ? (
        <span className="contact-table-avatar">{contactInitial(row.contact.display_name)}</span>
      ) : null
    },
    {
      id: "name",
      header: "Name",
      defaultWidth: 300,
      minWidth: 180,
      maxWidth: 520,
      renderCell: (row) => row.kind === "contact" ? (
        <span className="contact-name-stack"><strong>{row.contact.display_name}</strong></span>
      ) : null,
      getCellTitle: (row) => row.kind === "contact" ? row.contact.display_name : undefined
    },
    {
      id: "email",
      header: "Email",
      defaultWidth: 240,
      minWidth: 160,
      maxWidth: 420,
      renderCell: (row) => contactValue(row, "email"),
      getCellTitle: (row) => contactTitle(row, "email")
    },
    {
      id: "phone",
      header: "Phone",
      defaultWidth: 180,
      minWidth: 130,
      maxWidth: 320,
      renderCell: (row) => contactValue(row, "phone"),
      getCellTitle: (row) => contactTitle(row, "phone")
    },
    {
      id: "address",
      header: "Address",
      defaultWidth: 320,
      minWidth: 180,
      maxWidth: 560,
      renderCell: (row) => contactValue(row, "address"),
      getCellTitle: (row) => contactTitle(row, "address")
    },
    {
      id: "organization",
      header: "Organization",
      defaultWidth: 260,
      minWidth: 160,
      maxWidth: 460,
      renderCell: (row) => organizationValue(row),
      getCellTitle: (row) => organizationTitle(row)
    },
    {
      id: "open",
      header: <span className="visually-hidden">Open</span>,
      defaultWidth: 56,
      minWidth: 48,
      maxWidth: 64,
      resizable: false,
      cellClassName: "open-cell",
      renderCell: (row) => row.kind === "contact" ? (
        <button
          type="button"
          className="contact-table-open"
          aria-label={`Open ${row.contact.display_name}`}
          title={`Open ${row.contact.display_name}`}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(row.contact.id);
          }}
        >
          <PanelRightOpen size={15} aria-hidden="true" />
        </button>
      ) : null
    }
  ];
}

export function ContactsTable({
  contacts,
  selectedContactId,
  onSelect,
  groupBy = "none"
}: {
  contacts: ContactRecord[];
  selectedContactId: string;
  onSelect: (id: string) => void;
  groupBy?: ContactGroupBy;
}) {
  const selectFromKeyboard = (event: KeyboardEvent, contactId: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(contactId);
    }
  };

  const groups = groupContacts(contacts, groupBy);
  const columns = useMemo(() => contactColumns(onSelect), [onSelect]);
  const rows = groups.flatMap((group) => [
    ...(groupBy !== "none" ? [{ kind: "group" as const, id: `group-${group.id}`, label: group.label }] : []),
    ...group.contacts.map((contact) => ({ kind: "contact" as const, contact }))
  ]);

  return (
    <ResizableDataTable
      ariaLabel="Contact records"
      columns={columns}
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
  );
}

function contactGroupRow(row: ContactTableRow): DataTableSpanRow | null {
  return row.kind === "group" ? { className: "contacts-table-group-row", content: row.label } : null;
}

function contactTitle(row: ContactTableRow, field: "address" | "email" | "phone") {
  return row.kind === "contact" ? row.contact[field] || undefined : undefined;
}

function contactValue(row: ContactTableRow, field: "address" | "email" | "phone") {
  return row.kind === "contact" ? row.contact[field] || "-" : null;
}

function organizationTitle(row: ContactTableRow) {
  return row.kind === "contact" ? row.contact.organization_name || row.contact.title || undefined : undefined;
}

function organizationValue(row: ContactTableRow) {
  return row.kind === "contact" ? row.contact.organization_name || row.contact.title || "-" : null;
}

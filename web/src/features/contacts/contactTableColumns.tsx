import { PanelRightOpen } from "lucide-react";

import { formatDate, formatLabel } from "../../shared/format";
import { type ColumnVisibilityOption, type DataTableColumn } from "../../shared/tables";
import type { ContactRecord } from "../../shared/types";
import { contactInitial } from "./contactPresentation";

export type ContactTableRow =
  | { kind: "group"; id: string; label: string }
  | { kind: "contact"; contact: ContactRecord };

export const contactTableColumnVisibilityOptions: ColumnVisibilityOption[] = [
  { id: "name", label: "Name", locked: true },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "address", label: "Address" },
  { id: "organization", label: "Organization" },
  { id: "website", label: "Website", defaultVisible: false },
  { id: "title", label: "Title", defaultVisible: false },
  { id: "party_type", label: "Type", defaultVisible: false },
  { id: "status", label: "Status", defaultVisible: false },
  { id: "review_state", label: "Review", defaultVisible: false },
  { id: "source", label: "Source", defaultVisible: false },
  { id: "groups", label: "Groups", defaultVisible: false },
  { id: "updated_at", label: "Updated", defaultVisible: false },
  { id: "created_at", label: "Created", defaultVisible: false }
];

export function contactTableColumns(onSelect: (id: string) => void): DataTableColumn<ContactTableRow>[] {
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
    contactNameColumn(),
    contactFieldColumn("email", "Email", 240, 160, 420),
    contactFieldColumn("phone", "Phone", 180, 130, 320),
    contactFieldColumn("address", "Address", 320, 180, 560),
    {
      id: "organization",
      header: "Organization",
      defaultWidth: 260,
      minWidth: 160,
      maxWidth: 460,
      renderCell: (row) => organizationValue(row),
      getCellTitle: (row) => organizationTitle(row)
    },
    contactFieldColumn("website", "Website", 260, 160, 460),
    contactFieldColumn("title", "Title", 240, 160, 420),
    stateColumn("party_type", "Type", "party_type"),
    stateColumn("status", "Status", "status"),
    stateColumn("review_state", "Review", "review_state"),
    stateColumn("source", "Source", "source"),
    {
      id: "groups",
      header: "Groups",
      defaultWidth: 260,
      minWidth: 160,
      maxWidth: 460,
      renderCell: (row) => contactGroupsValue(row),
      getCellTitle: (row) => contactGroupsTitle(row)
    },
    dateColumn("updated_at", "Updated", "updated_at"),
    dateColumn("created_at", "Created", "created_at"),
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

function contactNameColumn(): DataTableColumn<ContactTableRow> {
  return {
    id: "name",
    header: "Name",
    defaultWidth: 300,
    minWidth: 180,
    maxWidth: 520,
    renderCell: (row) => row.kind === "contact" ? (
      <span className="contact-name-stack"><strong>{row.contact.display_name}</strong></span>
    ) : null,
    getCellTitle: (row) => row.kind === "contact" ? row.contact.display_name : undefined
  };
}

function contactFieldColumn(
  field: "address" | "email" | "phone" | "title" | "website",
  header: string,
  defaultWidth: number,
  minWidth: number,
  maxWidth: number
): DataTableColumn<ContactTableRow> {
  return {
    id: field,
    header,
    defaultWidth,
    minWidth,
    maxWidth,
    renderCell: (row) => contactValue(row, field),
    getCellTitle: (row) => contactTitle(row, field)
  };
}

function stateColumn(
  id: "party_type" | "review_state" | "source" | "status",
  header: string,
  field: "party_type" | "review_state" | "source" | "status"
): DataTableColumn<ContactTableRow> {
  return {
    id,
    header,
    defaultWidth: 160,
    minWidth: 120,
    maxWidth: 260,
    renderCell: (row) => row.kind === "contact" ? formatLabel(row.contact[field]) : null,
    getCellTitle: (row) => row.kind === "contact" ? formatLabel(row.contact[field]) : undefined
  };
}

function dateColumn(
  id: "created_at" | "updated_at",
  header: string,
  field: "created_at" | "updated_at"
): DataTableColumn<ContactTableRow> {
  return {
    id,
    header,
    defaultWidth: 180,
    minWidth: 140,
    maxWidth: 260,
    renderCell: (row) => row.kind === "contact" ? formatDate(row.contact[field]) : null,
    getCellTitle: (row) => row.kind === "contact" ? formatDate(row.contact[field]) : undefined
  };
}

function contactTitle(row: ContactTableRow, field: "address" | "email" | "phone" | "title" | "website") {
  return row.kind === "contact" ? row.contact[field] || undefined : undefined;
}

function contactValue(row: ContactTableRow, field: "address" | "email" | "phone" | "title" | "website") {
  return row.kind === "contact" ? row.contact[field] || "-" : null;
}

function organizationTitle(row: ContactTableRow) {
  return row.kind === "contact" ? row.contact.organization_name || row.contact.title || undefined : undefined;
}

function organizationValue(row: ContactTableRow) {
  return row.kind === "contact" ? row.contact.organization_name || row.contact.title || "-" : null;
}

function contactGroupsTitle(row: ContactTableRow) {
  return row.kind === "contact" ? contactGroupNames(row.contact).join(", ") || undefined : undefined;
}

function contactGroupsValue(row: ContactTableRow) {
  if (row.kind !== "contact") return null;
  const names = contactGroupNames(row.contact);
  return names.length ? names.join(", ") : "-";
}

function contactGroupNames(contact: ContactRecord) {
  return contact.groups?.map((group) => group.name).filter(Boolean) ?? [];
}

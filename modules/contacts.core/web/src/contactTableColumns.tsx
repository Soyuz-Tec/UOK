import { PanelRightOpen } from "lucide-react";

import { type ColumnVisibilityOption, type DataTableColumn } from "@uok/shared/tables";
import type { ContactRecord } from "@uok/shared/types";
import { contactFieldTitle, contactFieldValue, contactVisibilityOptions, type ContactFieldId } from "./contactFieldRegistry";
import { contactInitial } from "./contactPresentation";

export type ContactTableRow =
  | { kind: "group"; id: string; label: string }
  | { kind: "contact"; contact: ContactRecord };

export const contactTableColumnVisibilityOptions: ColumnVisibilityOption[] = contactVisibilityOptions([
  "name",
  "email",
  "phone",
  "address",
  "organization",
  "website",
  "title",
  "party_type",
  "status",
  "review_state",
  "source",
  "groups",
  "updated_at",
  "created_at"
]);

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
    contactFieldColumn("email", 240, 160, 420),
    contactFieldColumn("phone", 180, 130, 320),
    contactFieldColumn("address", 320, 180, 560),
    contactFieldColumn("organization", 260, 160, 460),
    contactFieldColumn("website", 260, 160, 460),
    contactFieldColumn("title", 240, 160, 420),
    contactFieldColumn("party_type", 160, 120, 260),
    contactFieldColumn("status", 160, 120, 260),
    contactFieldColumn("review_state", 160, 120, 260),
    contactFieldColumn("source", 160, 120, 260),
    contactFieldColumn("groups", 260, 160, 460),
    contactFieldColumn("updated_at", 180, 140, 260),
    contactFieldColumn("created_at", 180, 140, 260),
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
  field: ContactFieldId,
  defaultWidth: number,
  minWidth: number,
  maxWidth: number
): DataTableColumn<ContactTableRow> {
  return {
    id: field,
    header: contactTableColumnVisibilityOptions.find((option) => option.id === field)?.label || field,
    defaultWidth,
    minWidth,
    maxWidth,
    renderCell: (row) => row.kind === "contact" ? contactFieldValue(row.contact, field, "-") : null,
    getCellTitle: (row) => row.kind === "contact" ? contactFieldTitle(row.contact, field) : undefined
  };
}

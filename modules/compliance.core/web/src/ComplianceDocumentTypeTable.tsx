import type { KeyboardEvent } from "react";

import { EmptyState, StatusPill } from "@uok/shared/data-display";
import { ResizableDataTable, type DataTableColumn } from "@uok/shared/tables";
import type { ComplianceDocumentType } from "./types";

const columns: DataTableColumn<ComplianceDocumentType>[] = [
  {
    id: "code",
    header: "Code",
    defaultWidth: 190,
    minWidth: 140,
    renderCell: (documentType) => <strong>{documentType.code}</strong>,
  },
  {
    id: "name",
    header: "Canonical name",
    defaultWidth: 260,
    minWidth: 180,
    renderCell: (documentType) => documentType.canonical_name,
  },
  {
    id: "category",
    header: "Category",
    defaultWidth: 150,
    minWidth: 120,
    renderCell: (documentType) => documentType.category || "Uncategorized",
  },
  {
    id: "status",
    header: "Status",
    defaultWidth: 130,
    minWidth: 110,
    renderCell: (documentType) => (
      <StatusPill
        label={statusLabel(documentType.status)}
        tone={statusTone(documentType)}
      />
    ),
  },
];

export function ComplianceDocumentTypeTable({
  documentTypes,
  selectedId,
  onSelect,
}: {
  documentTypes: ComplianceDocumentType[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ResizableDataTable
      ariaLabel="Compliance document types"
      columns={columns}
      rows={documentTypes}
      getRowKey={(documentType) => documentType.id}
      storageKey="uok_compliance_document_type_table_widths"
      emptyState={(
        <EmptyState
          title="No matching document types"
          text="Adjust the search or create a compliance document type."
        />
      )}
      rowAriaLabel={(documentType) => `${documentType.code} ${documentType.canonical_name}`}
      rowAriaSelected={(documentType) => documentType.id === selectedId}
      rowClassName={(documentType) => documentType.id === selectedId ? "selected" : ""}
      rowTabIndex={() => 0}
      onRowClick={(documentType) => onSelect(documentType.id)}
      onRowKeyDown={(event, documentType) => selectFromKeyboard(
        event,
        documentType.id,
        onSelect,
      )}
    />
  );
}

function selectFromKeyboard(
  event: KeyboardEvent<HTMLTableRowElement>,
  id: string,
  onSelect: (id: string) => void,
) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  onSelect(id);
}

function statusLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function statusTone(documentType: ComplianceDocumentType) {
  if (documentType.status === "active") return "success";
  if (documentType.status === "archived") return "danger";
  return "warning";
}

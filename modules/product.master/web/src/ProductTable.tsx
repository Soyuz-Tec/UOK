import type { KeyboardEvent } from "react";

import { EmptyState, StatusPill } from "@uok/shared/data-display";
import { ResizableDataTable, type DataTableColumn } from "@uok/shared/tables";
import type { ProductDefinition } from "./types";

const columns: DataTableColumn<ProductDefinition>[] = [
  { id: "code", header: "Code", defaultWidth: 140, minWidth: 110, renderCell: (product) => <strong>{product.code}</strong> },
  { id: "name", header: "Canonical name", defaultWidth: 240, minWidth: 180, renderCell: (product) => product.canonical_name },
  { id: "category", header: "Category", defaultWidth: 160, minWidth: 130, renderCell: (product) => product.category || "—" },
  { id: "grade", header: "Grade", defaultWidth: 140, minWidth: 110, renderCell: (product) => product.grade || "—" },
  { id: "unit", header: "Base unit", defaultWidth: 120, minWidth: 100, renderCell: (product) => product.base_unit_code || "—" },
  { id: "status", header: "Status", defaultWidth: 130, minWidth: 110, renderCell: (product) => <StatusPill label={product.status} tone={product.status === "active" ? "success" : "warning"} /> },
];

export function ProductTable({
  products,
  selectedId,
  onSelect,
}: {
  products: ProductDefinition[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ResizableDataTable
      ariaLabel="Product definitions"
      columns={columns}
      rows={products}
      getRowKey={(product) => product.id}
      storageKey="uok_product_master_table_widths"
      emptyState={<EmptyState title="No matching products" text="Adjust the search or create a product definition." />}
      rowAriaLabel={(product) => `${product.code} ${product.canonical_name}`}
      rowAriaSelected={(product) => product.id === selectedId}
      rowClassName={(product) => product.id === selectedId ? "selected" : ""}
      rowTabIndex={() => 0}
      onRowClick={(product) => onSelect(product.id)}
      onRowKeyDown={(event, product) => selectFromKeyboard(event, product.id, onSelect)}
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

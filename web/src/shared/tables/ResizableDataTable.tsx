import type { KeyboardEvent, ReactNode } from "react";

import { ColumnResizeHandle } from "./ColumnResizeHandle";
import { useResizableColumns } from "./useResizableColumns";
import type { DataTableColumn, DataTableSpanRow } from "./types";

export function ResizableDataTable<T>({
  ariaLabel,
  columns,
  emptyState,
  getRowKey,
  rows,
  rowAriaLabel,
  rowAriaSelected,
  rowClassName,
  rowTabIndex,
  spanRow,
  storageKey,
  tableClassName,
  wrapperClassName,
  onRowClick,
  onRowKeyDown
}: {
  ariaLabel: string;
  columns: DataTableColumn<T>[];
  emptyState: ReactNode;
  getRowKey: (row: T) => string;
  rows: T[];
  rowAriaLabel?: (row: T) => string | undefined;
  rowAriaSelected?: (row: T) => boolean | undefined;
  rowClassName?: (row: T) => string;
  rowTabIndex?: (row: T) => number | undefined;
  spanRow?: (row: T) => DataTableSpanRow | null;
  storageKey: string;
  tableClassName?: string;
  wrapperClassName?: string;
  onRowClick?: (row: T) => void;
  onRowKeyDown?: (event: KeyboardEvent<HTMLTableRowElement>, row: T) => void;
}) {
  const { resetColumnWidth, setColumnWidth, totalWidth, widths } = useResizableColumns(columns, storageKey);
  const className = ["resizable-data-table", tableClassName].filter(Boolean).join(" ");

  return (
    <div className={["resizable-data-table-wrap", wrapperClassName].filter(Boolean).join(" ")}>
      <table className={className} role="grid" aria-label={ariaLabel} style={{ width: totalWidth, minWidth: "100%" }}>
        <colgroup>
          {columns.map((column) => <col key={column.id} style={{ width: widths[column.id] }} />)}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.id} className={column.headerClassName}>
                <span className="resizable-data-table-header-label">{column.header}</span>
                {column.resizable === false ? null : (
                  <ColumnResizeHandle
                    label={columnLabel(column)}
                    maxWidth={column.maxWidth}
                    minWidth={column.minWidth}
                    width={widths[column.id]}
                    onReset={() => resetColumnWidth(column.id)}
                    onResize={(width) => setColumnWidth(column.id, width)}
                  />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row) => renderRow(row, columns, {
            getRowKey,
            onRowClick,
            onRowKeyDown,
            rowAriaLabel,
            rowAriaSelected,
            rowClassName,
            rowTabIndex,
            spanRow
          })) : (
            <tr>
              <td className="empty-table-cell" colSpan={columns.length}>{emptyState}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function columnLabel<T>(column: DataTableColumn<T>) {
  return typeof column.header === "string" && column.header ? column.header : column.id;
}

function renderRow<T>(
  row: T,
  columns: DataTableColumn<T>[],
  options: {
    getRowKey: (row: T) => string;
    rowClassName?: (row: T) => string;
    rowTabIndex?: (row: T) => number | undefined;
    rowAriaLabel?: (row: T) => string | undefined;
    rowAriaSelected?: (row: T) => boolean | undefined;
    spanRow?: (row: T) => DataTableSpanRow | null;
    onRowClick?: (row: T) => void;
    onRowKeyDown?: (event: KeyboardEvent<HTMLTableRowElement>, row: T) => void;
  }
) {
  const span = options.spanRow?.(row);
  if (span) {
    return (
      <tr key={options.getRowKey(row)} className={span.className}>
        <th colSpan={columns.length} scope={span.scope ?? "rowgroup"}>{span.content}</th>
      </tr>
    );
  }

  return (
    <tr
      key={options.getRowKey(row)}
      className={options.rowClassName?.(row)}
      tabIndex={options.rowTabIndex?.(row)}
      aria-label={options.rowAriaLabel?.(row)}
      aria-selected={options.rowAriaSelected?.(row)}
      data-clickable={options.onRowClick ? "true" : undefined}
      onClick={() => options.onRowClick?.(row)}
      onKeyDown={(event) => options.onRowKeyDown?.(event, row)}
    >
      {columns.map((column) => (
        <td key={column.id} className={cellClassName(column, row)} title={column.getCellTitle?.(row)}>
          {column.renderCell(row)}
        </td>
      ))}
    </tr>
  );
}

function cellClassName<T>(column: DataTableColumn<T>, row: T) {
  return typeof column.cellClassName === "function" ? column.cellClassName(row) : column.cellClassName;
}

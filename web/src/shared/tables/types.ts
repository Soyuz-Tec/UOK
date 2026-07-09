import type { ReactNode } from "react";

export type ColumnWidthMap = Record<string, number>;

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;
  headerClassName?: string;
  cellClassName?: string | ((row: T) => string);
  renderCell: (row: T) => ReactNode;
  getCellTitle?: (row: T) => string | undefined;
};

export type DataTableSpanRow = {
  className?: string;
  content: ReactNode;
  scope?: "row" | "rowgroup";
};

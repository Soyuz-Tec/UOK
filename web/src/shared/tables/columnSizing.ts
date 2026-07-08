import type { ColumnWidthMap, DataTableColumn } from "./types";
import { readStorageJson, writeStorageJson } from "../storage";

const storagePrefix = "uok_column_widths:";

export function columnStorageKey(storageKey: string) {
  return `${storagePrefix}${storageKey}`;
}

export function clampColumnWidth(value: number, minWidth = 80, maxWidth = 640) {
  if (!Number.isFinite(value)) return minWidth;
  return Math.min(Math.max(Math.round(value), minWidth), maxWidth);
}

export function defaultColumnWidths<T>(columns: DataTableColumn<T>[]) {
  return columns.reduce<ColumnWidthMap>((widths, column) => {
    widths[column.id] = clampColumnWidth(column.defaultWidth, column.minWidth, column.maxWidth);
    return widths;
  }, {});
}

export function normalizeColumnWidths<T>(columns: DataTableColumn<T>[], widths: ColumnWidthMap) {
  return columns.reduce<ColumnWidthMap>((nextWidths, column) => {
    const fallback = column.defaultWidth;
    const stored = widths[column.id] ?? fallback;
    nextWidths[column.id] = clampColumnWidth(stored, column.minWidth, column.maxWidth);
    return nextWidths;
  }, {});
}

export function readColumnWidths<T>(
  columns: DataTableColumn<T>[],
  storageKey: string
) {
  const stored = readStorageJson("local", columnStorageKey(storageKey), {}, isColumnWidthMap);
  return normalizeColumnWidths(columns, stored);
}

export function writeColumnWidths(storageKey: string, widths: ColumnWidthMap) {
  writeStorageJson("local", columnStorageKey(storageKey), widths);
}

function isColumnWidthMap(value: unknown): value is ColumnWidthMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((item) => typeof item === "number");
}

import type { ColumnWidthMap, DataTableColumn } from "./types";

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
  storageKey: string,
  storage: Storage | null = localColumnStorage()
) {
  if (!storage) return defaultColumnWidths(columns);

  try {
    const rawValue = storage.getItem(columnStorageKey(storageKey));
    const stored = rawValue ? JSON.parse(rawValue) : {};
    return normalizeColumnWidths(columns, isColumnWidthMap(stored) ? stored : {});
  } catch {
    return defaultColumnWidths(columns);
  }
}

export function writeColumnWidths(storageKey: string, widths: ColumnWidthMap, storage: Storage | null = localColumnStorage()) {
  if (!storage) return;
  try {
    storage.setItem(columnStorageKey(storageKey), JSON.stringify(widths));
  } catch {
    // Column resizing is a preference. Storage failures must not block record work.
  }
}

function isColumnWidthMap(value: unknown): value is ColumnWidthMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((item) => typeof item === "number");
}

function localColumnStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

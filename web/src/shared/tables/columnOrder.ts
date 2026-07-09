import { readStorageJson, writeStorageJson } from "../storage";

const storagePrefix = "uok_column_order:";

type OrderedColumn = { id: string };

export function columnOrderStorageKey(storageKey: string) {
  return `${storagePrefix}${storageKey}`;
}

export function normalizeColumnOrder<T extends OrderedColumn>(columns: T[], order: string[]) {
  const columnIds = new Set(columns.map((column) => column.id));
  const seen = new Set<string>();
  const orderedIds = order.filter((id) => columnIds.has(id) && !seen.has(id) && seen.add(id));
  const byId = new Map(columns.map((column) => [column.id, column]));
  return [
    ...orderedIds.map((id) => byId.get(id)).filter((column): column is T => Boolean(column)),
    ...columns.filter((column) => !seen.has(column.id)),
  ];
}

export function moveColumnBefore<T extends OrderedColumn>(columns: T[], sourceId: string, targetId: string) {
  if (sourceId === targetId) return columns;
  const source = columns.find((column) => column.id === sourceId);
  if (!source) return columns;
  const remaining = columns.filter((column) => column.id !== sourceId);
  const targetIndex = remaining.findIndex((column) => column.id === targetId);
  if (targetIndex < 0) return columns;
  return [...remaining.slice(0, targetIndex), source, ...remaining.slice(targetIndex)];
}

export function readColumnOrder<T extends OrderedColumn>(columns: T[], storageKey: string) {
  const stored = readStorageJson("local", columnOrderStorageKey(storageKey), [], isColumnOrder);
  return normalizeColumnOrder(columns, stored);
}

export function writeColumnOrder(storageKey: string, columns: OrderedColumn[]) {
  writeStorageJson("local", columnOrderStorageKey(storageKey), columns.map((column) => column.id));
}

function isColumnOrder(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

import { browserStorage } from "../storage";

const storagePrefix = "uok_column_visibility:";

export type ColumnVisibilityOption = {
  id: string;
  label: string;
  defaultVisible?: boolean;
  locked?: boolean;
};

export type ColumnVisibilityMap = Record<string, boolean>;

export function columnVisibilityStorageKey(storageKey: string) {
  return `${storagePrefix}${storageKey}`;
}

export function defaultColumnVisibility(options: ColumnVisibilityOption[]) {
  return options.reduce<ColumnVisibilityMap>((visibility, option) => {
    visibility[option.id] = option.locked || option.defaultVisible !== false;
    return visibility;
  }, {});
}

export function normalizeColumnVisibility(options: ColumnVisibilityOption[], visibility: ColumnVisibilityMap) {
  const defaults = defaultColumnVisibility(options);
  return options.reduce<ColumnVisibilityMap>((nextVisibility, option) => {
    nextVisibility[option.id] = option.locked ? true : visibility[option.id] ?? defaults[option.id];
    return nextVisibility;
  }, {});
}

export function readColumnVisibility(
  options: ColumnVisibilityOption[],
  storageKey: string,
  storage: Storage | null = localColumnVisibilityStorage()
) {
  if (!storage) return defaultColumnVisibility(options);

  try {
    const rawValue = storage.getItem(columnVisibilityStorageKey(storageKey));
    const stored = rawValue ? JSON.parse(rawValue) : {};
    return normalizeColumnVisibility(options, isColumnVisibilityMap(stored) ? stored : {});
  } catch {
    return defaultColumnVisibility(options);
  }
}

export function writeColumnVisibility(
  storageKey: string,
  visibility: ColumnVisibilityMap,
  storage: Storage | null = localColumnVisibilityStorage()
) {
  if (!storage) return;
  try {
    storage.setItem(columnVisibilityStorageKey(storageKey), JSON.stringify(visibility));
  } catch {
    // Column visibility is a preference. Storage failures must not block record work.
  }
}

function isColumnVisibilityMap(value: unknown): value is ColumnVisibilityMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((item) => typeof item === "boolean");
}

function localColumnVisibilityStorage() {
  return browserStorage("local");
}

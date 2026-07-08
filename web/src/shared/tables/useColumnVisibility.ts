import { useCallback, useEffect, useMemo, useState } from "react";

import {
  defaultColumnVisibility,
  normalizeColumnVisibility,
  readColumnVisibility,
  writeColumnVisibility,
  type ColumnVisibilityMap,
  type ColumnVisibilityOption
} from "./columnVisibility";
import type { DataTableColumn } from "./types";

export function useColumnVisibility<T>(
  columns: DataTableColumn<T>[],
  storageKey: string,
  options: ColumnVisibilityOption[]
) {
  const defaults = useMemo(() => defaultColumnVisibility(options), [options]);
  const optionIds = useMemo(() => new Set(options.map((option) => option.id)), [options]);
  const lockedIds = useMemo(() => new Set(options.filter((option) => option.locked).map((option) => option.id)), [options]);
  const [visibility, setVisibility] = useState<ColumnVisibilityMap>(() => readColumnVisibility(options, storageKey));

  useEffect(() => {
    setVisibility((currentVisibility) => normalizeColumnVisibility(options, currentVisibility));
  }, [options]);

  useEffect(() => {
    writeColumnVisibility(storageKey, visibility);
  }, [storageKey, visibility]);

  const setColumnVisible = useCallback((columnId: string, visible: boolean) => {
    if (lockedIds.has(columnId)) return;
    setVisibility((currentVisibility) => normalizeColumnVisibility(options, { ...currentVisibility, [columnId]: visible }));
  }, [lockedIds, options]);

  const resetColumnVisibility = useCallback(() => {
    setVisibility(defaults);
  }, [defaults]);

  const visibleColumns = useMemo(
    () => columns.filter((column) => !optionIds.has(column.id) || visibility[column.id] !== false),
    [columns, optionIds, visibility]
  );

  return { resetColumnVisibility, setColumnVisible, visibility, visibleColumns };
}

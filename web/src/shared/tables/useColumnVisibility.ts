import { useMemo } from "react";

import type { ColumnVisibilityOption } from "./columnVisibility";
import type { DataTableColumn } from "./types";
import { useColumnVisibilityOptions } from "./useColumnVisibilityOptions";

export function useColumnVisibility<T>(
  columns: DataTableColumn<T>[],
  storageKey: string,
  options: ColumnVisibilityOption[]
) {
  const optionIds = useMemo(() => new Set(options.map((option) => option.id)), [options]);
  const { resetColumnVisibility, setColumnVisible, visibility } = useColumnVisibilityOptions(storageKey, options);

  const visibleColumns = useMemo(
    () => columns.filter((column) => !optionIds.has(column.id) || visibility[column.id] !== false),
    [columns, optionIds, visibility]
  );

  return { resetColumnVisibility, setColumnVisible, visibility, visibleColumns };
}

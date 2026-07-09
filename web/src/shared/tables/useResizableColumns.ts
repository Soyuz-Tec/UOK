import { useCallback, useEffect, useMemo, useState } from "react";

import { normalizeColumnWidths, readColumnWidths, writeColumnWidths } from "./columnSizing";
import type { ColumnWidthMap, DataTableColumn } from "./types";

export function useResizableColumns<T>(columns: DataTableColumn<T>[], storageKey: string) {
  const defaults = useMemo(() => normalizeColumnWidths(columns, {}), [columns]);
  const [widths, setWidths] = useState<ColumnWidthMap>(() => readColumnWidths(columns, storageKey));

  useEffect(() => {
    setWidths((currentWidths) => normalizeColumnWidths(columns, currentWidths));
  }, [columns]);

  useEffect(() => {
    writeColumnWidths(storageKey, widths);
  }, [storageKey, widths]);

  const setColumnWidth = useCallback((columnId: string, width: number) => {
    const column = columns.find((item) => item.id === columnId);
    if (!column) return;
    setWidths((currentWidths) => normalizeColumnWidths(columns, { ...currentWidths, [columnId]: width }));
  }, [columns]);

  const resetColumnWidth = useCallback((columnId: string) => {
    setWidths((currentWidths) => {
      const nextWidths = { ...currentWidths };
      nextWidths[columnId] = defaults[columnId];
      return normalizeColumnWidths(columns, nextWidths);
    });
  }, [columns, defaults]);

  const totalWidth = useMemo(
    () => columns.reduce((total, column) => total + (widths[column.id] ?? defaults[column.id]), 0),
    [columns, defaults, widths]
  );

  return { resetColumnWidth, setColumnWidth, totalWidth, widths };
}

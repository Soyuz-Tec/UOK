import { useCallback, useEffect, useState } from "react";

import { moveColumnBefore as moveBefore, normalizeColumnOrder, readColumnOrder, writeColumnOrder } from "./columnOrder";

type OrderedColumn = { id: string };

export function useColumnOrder<T extends OrderedColumn>(columns: T[], storageKey: string) {
  const [orderedColumns, setOrderedColumns] = useState<T[]>(() => readColumnOrder(columns, storageKey));

  useEffect(() => {
    setOrderedColumns((current) => normalizeColumnOrder(columns, current.map((column) => column.id)));
  }, [columns]);

  useEffect(() => {
    writeColumnOrder(storageKey, orderedColumns);
  }, [orderedColumns, storageKey]);

  const moveColumnBefore = useCallback((sourceId: string, targetId: string) => {
    setOrderedColumns((current) => moveBefore(normalizeColumnOrder(columns, current.map((column) => column.id)), sourceId, targetId));
  }, [columns]);

  const resetColumnOrder = useCallback(() => {
    setOrderedColumns(columns);
  }, [columns]);

  return { moveColumnBefore, orderedColumns, resetColumnOrder };
}

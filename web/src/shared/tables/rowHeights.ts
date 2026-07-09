import { useCallback, useEffect, useMemo, useState } from "react";

import { readStorageJson, writeStorageJson } from "../storage";

export type RowHeightMap = Record<string, number>;
export type RowLayout = { rowId: string; top: number; height: number };

export function clampRowHeight(height: number, minHeight: number, maxHeight: number) {
  return Math.round(Math.min(Math.max(height, minHeight), maxHeight));
}

export function rowLayouts<T>(rows: T[], rowId: (row: T) => string, baseHeight: number, overrides: RowHeightMap, minHeight: number, maxHeight: number) {
  let top = 0;
  const layouts = rows.map((row) => {
    const id = rowId(row);
    const height = clampRowHeight(overrides[id] || baseHeight, minHeight, maxHeight);
    const layout = { rowId: id, top, height };
    top += height;
    return layout;
  });
  return { layouts, totalHeight: top };
}

export function rowLayoutMap(layouts: RowLayout[]) {
  return new Map(layouts.map((layout) => [layout.rowId, layout]));
}

export function fitRowHeight(contentHeight: number, baseHeight: number, minHeight: number, maxHeight: number) {
  return clampRowHeight(Math.max(baseHeight, contentHeight + 4), minHeight, maxHeight);
}

export function useStoredRowHeights(storageKey: string, minHeight: number, maxHeight: number) {
  const [rowHeights, setRowHeights] = useState<RowHeightMap>(() => readRowHeights(storageKey));
  const normalizedStorageKey = useMemo(() => storageKey, [storageKey]);

  useEffect(() => setRowHeights(readRowHeights(normalizedStorageKey)), [normalizedStorageKey]);
  useEffect(() => writeStorageJson("local", normalizedStorageKey, rowHeights), [normalizedStorageKey, rowHeights]);

  const setRowHeight = useCallback((rowId: string, height: number) => {
    setRowHeights((current) => ({ ...current, [rowId]: clampRowHeight(height, minHeight, maxHeight) }));
  }, [maxHeight, minHeight]);

  const resetRowHeight = useCallback((rowId: string) => {
    setRowHeights((current) => {
      const next = { ...current };
      delete next[rowId];
      return next;
    });
  }, []);

  return { resetRowHeight, rowHeights, setRowHeight };
}

function readRowHeights(storageKey: string) {
  return readStorageJson<RowHeightMap>("local", storageKey, {}, isRowHeightMap);
}

function isRowHeightMap(value: unknown): value is RowHeightMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((height) => typeof height === "number" && Number.isFinite(height));
}

import { useCallback, useEffect, useMemo, useState } from "react";

import { readStorageJson, writeStorageJson } from "../../shared/storage";
import type { PlanningTask } from "./types";

export type PlanningRowHeightMap = Record<string, number>;
export type PlanningRowLayout = { taskId: string; top: number; height: number };

const storagePrefix = "uok:planning:gantt:row-heights:";
export const planningRowMinHeight = 34;
export const planningRowMaxHeight = 96;

export function planningRowHeightStorageKey(projectId: string) {
  return `${storagePrefix}${projectId}`;
}

export function clampPlanningRowHeight(height: number) {
  return Math.round(Math.min(Math.max(height, planningRowMinHeight), planningRowMaxHeight));
}

export function planningRowLayouts(tasks: PlanningTask[], baseHeight: number, overrides: PlanningRowHeightMap) {
  let top = 0;
  const layouts: PlanningRowLayout[] = tasks.map((task) => {
    const height = clampPlanningRowHeight(overrides[task.id] || baseHeight);
    const layout = { taskId: task.id, top, height };
    top += height;
    return layout;
  });
  return { layouts, totalHeight: top };
}

export function planningRowLayoutMap(layouts: PlanningRowLayout[]) {
  return new Map(layouts.map((layout) => [layout.taskId, layout]));
}

export function fitPlanningRowHeight(contentHeight: number, baseHeight: number) {
  return clampPlanningRowHeight(Math.max(baseHeight, contentHeight + 4));
}

export function usePlanningRowHeights(projectId: string) {
  const storageKey = useMemo(() => planningRowHeightStorageKey(projectId), [projectId]);
  const [rowHeights, setRowHeights] = useState<PlanningRowHeightMap>(() => readRowHeights(storageKey));

  useEffect(() => {
    setRowHeights(readRowHeights(storageKey));
  }, [storageKey]);

  useEffect(() => {
    writeStorageJson("local", storageKey, rowHeights);
  }, [rowHeights, storageKey]);

  const setRowHeight = useCallback((taskId: string, height: number) => {
    setRowHeights((current) => ({ ...current, [taskId]: clampPlanningRowHeight(height) }));
  }, []);

  const resetRowHeight = useCallback((taskId: string) => {
    setRowHeights((current) => {
      const next = { ...current };
      delete next[taskId];
      return next;
    });
  }, []);

  return { resetRowHeight, rowHeights, setRowHeight };
}

function readRowHeights(storageKey: string) {
  return readStorageJson<PlanningRowHeightMap>("local", storageKey, {}, isPlanningRowHeightMap);
}

function isPlanningRowHeightMap(value: unknown): value is PlanningRowHeightMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((height) => typeof height === "number" && Number.isFinite(height));
}

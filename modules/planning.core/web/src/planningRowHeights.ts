import { clampRowHeight, fitRowHeight, rowLayoutMap, rowLayouts, useStoredRowHeights, type RowHeightMap } from "@uok/shared/tables";
import type { PlanningTask } from "./types";

export type PlanningRowHeightMap = RowHeightMap;
export type PlanningRowLayout = { taskId: string; top: number; height: number };

const storagePrefix = "uok:planning:gantt:row-heights:";
export const planningRowMinHeight = 34;
export const planningRowMaxHeight = 96;

export function planningRowHeightStorageKey(projectId: string) {
  return `${storagePrefix}${projectId}`;
}

export function clampPlanningRowHeight(height: number) {
  return clampRowHeight(height, planningRowMinHeight, planningRowMaxHeight);
}

export function planningRowLayouts(tasks: PlanningTask[], baseHeight: number, overrides: PlanningRowHeightMap) {
  const state = rowLayouts(tasks, (task) => task.id, baseHeight, overrides, planningRowMinHeight, planningRowMaxHeight);
  return {
    layouts: state.layouts.map((layout) => ({ taskId: layout.rowId, top: layout.top, height: layout.height })),
    totalHeight: state.totalHeight,
  };
}

export function planningRowLayoutMap(layouts: PlanningRowLayout[]) {
  const shared = rowLayoutMap(layouts.map((layout) => ({ rowId: layout.taskId, top: layout.top, height: layout.height })));
  return new Map(Array.from(shared, ([taskId, layout]) => [taskId, { taskId, top: layout.top, height: layout.height }]));
}

export function fitPlanningRowHeight(contentHeight: number, baseHeight: number) {
  return fitRowHeight(contentHeight, baseHeight, planningRowMinHeight, planningRowMaxHeight);
}

export function usePlanningRowHeights(projectId: string) {
  return useStoredRowHeights(planningRowHeightStorageKey(projectId), planningRowMinHeight, planningRowMaxHeight);
}

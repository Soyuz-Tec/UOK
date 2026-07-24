import type { FieldPreset } from "./planningTimelineModel";

export const DEFAULT_PLANNING_SPLIT_PERCENT = 42;
export const MIN_PLANNING_SPLIT_PERCENT = 24;
export const MAX_PLANNING_SPLIT_PERCENT = 68;
export const MIN_PLANNING_GRID_WIDTH = 340;
export const MIN_PLANNING_CHART_WIDTH = 420;

const MIN_PLANNING_GANTT_WIDTH = MIN_PLANNING_GRID_WIDTH + MIN_PLANNING_CHART_WIDTH;
const GRID_MIN_SHARE = MIN_PLANNING_GRID_WIDTH / MIN_PLANNING_GANTT_WIDTH;

export type PlanningSplitKeyCommand = {
  handled: boolean;
  value: number;
};

export function clampPlanningSplitPercent(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_PLANNING_SPLIT_PERCENT;
  return Math.min(MAX_PLANNING_SPLIT_PERCENT, Math.max(MIN_PLANNING_SPLIT_PERCENT, Math.round(value * 10) / 10));
}

export function planningSplitBoundsForContainer(width: number) {
  if (!Number.isFinite(width) || width <= 0) {
    return { min: MIN_PLANNING_SPLIT_PERCENT, max: MAX_PLANNING_SPLIT_PERCENT };
  }
  const gridMin = Math.min(MIN_PLANNING_GRID_WIDTH, width * GRID_MIN_SHARE);
  const chartMin = Math.min(MIN_PLANNING_CHART_WIDTH, width * (1 - GRID_MIN_SHARE));
  return {
    min: Math.max(MIN_PLANNING_SPLIT_PERCENT, (gridMin / width) * 100),
    max: Math.min(MAX_PLANNING_SPLIT_PERCENT, 100 - (chartMin / width) * 100),
  };
}

export function fitPlanningSplitPercentToContainer(value: number, width: number) {
  const bounds = planningSplitBoundsForContainer(width);
  const bounded = Math.min(bounds.max, Math.max(bounds.min, clampPlanningSplitPercent(value)));
  return Math.round(bounded * 10) / 10;
}

export function planningSplitPercentFromPointer(clientX: number, left: number, width: number, rtl = false) {
  if (!Number.isFinite(width) || width <= 0) return DEFAULT_PLANNING_SPLIT_PERCENT;
  const offset = rtl ? left + width - clientX : clientX - left;
  return fitPlanningSplitPercentToContainer((offset / width) * 100, width);
}

export function planningSplitKeyCommand(current: number, key: string, shiftKey = false, rtl = false, containerWidth = 0): PlanningSplitKeyCommand {
  const step = shiftKey ? 5 : 1;
  const bounds = planningSplitBoundsForContainer(containerWidth);
  const fitted = fitPlanningSplitPercentToContainer(current, containerWidth);
  if (key === "Home") return { handled: true, value: fitPlanningSplitPercentToContainer(bounds.min, containerWidth) };
  if (key === "End") return { handled: true, value: fitPlanningSplitPercentToContainer(bounds.max, containerWidth) };
  if (key === "ArrowLeft") return { handled: true, value: fitPlanningSplitPercentToContainer(fitted + (rtl ? step : -step), containerWidth) };
  if (key === "ArrowRight") return { handled: true, value: fitPlanningSplitPercentToContainer(fitted + (rtl ? -step : step), containerWidth) };
  return { handled: false, value: current };
}

export function planningSplitStorageKey(projectId: string, fieldPreset: FieldPreset) {
  return `uok.planning.gantt.split.${projectId}.${fieldPreset}`;
}

export function readPlanningSplitPercent(projectId: string, fieldPreset: FieldPreset) {
  if (typeof window === "undefined") return DEFAULT_PLANNING_SPLIT_PERCENT;
  const stored = window.localStorage.getItem(planningSplitStorageKey(projectId, fieldPreset));
  if (stored === null || stored.trim() === "") return DEFAULT_PLANNING_SPLIT_PERCENT;
  return clampPlanningSplitPercent(Number(stored));
}

export function writePlanningSplitPercent(projectId: string, fieldPreset: FieldPreset, value: number) {
  const next = clampPlanningSplitPercent(value);
  if (typeof window !== "undefined") window.localStorage.setItem(planningSplitStorageKey(projectId, fieldPreset), String(next));
  return next;
}

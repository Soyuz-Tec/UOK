import type { PlanningTask } from "./types";
import { dateValue, durationBetween, xForDate, type TimelineScale } from "./planningGanttModel";

export type PlanningBaselineLane = {
  code: string;
  label: string;
  status: "aligned" | "early" | "late";
  varianceWidth: number;
  varianceX: number;
  width: number;
  x: number;
};

export function planningBaselineLane(task: PlanningTask, chartStart: Date, scale: TimelineScale, cellWidth: number): PlanningBaselineLane | null {
  if (!task.baseline_start || !task.baseline_end) return null;
  const x = xForDate(dateValue(task.baseline_start), chartStart, scale, cellWidth);
  const width = Math.max(cellWidth * durationBetween(task.baseline_start, task.baseline_end, scale), cellWidth * 0.5);
  const baselineEndX = x + width;
  const currentEndX = xForDate(dateValue(task.end), chartStart, scale, cellWidth) + cellWidth;
  const endVariance = task.end_variance_days ?? 0;
  const status = endVariance > 0 ? "late" : endVariance < 0 ? "early" : "aligned";
  return {
    code: `BL ${endVariance > 0 ? "+" : ""}${endVariance}d`,
    label: `${task.title} baseline ${task.baseline_start} to ${task.baseline_end}; end variance ${endVariance} days`,
    status,
    varianceWidth: Math.abs(currentEndX - baselineEndX),
    varianceX: Math.min(baselineEndX, currentEndX),
    width,
    x,
  };
}

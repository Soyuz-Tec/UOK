import { dateValue, xForDate, type TimelineScale } from "./planningGanttModel";
import type { PlanningTask } from "./types";

export function selectedTaskScrollLeft(task: PlanningTask, chartStart: Date, scale: TimelineScale, cellWidth: number, viewportWidth: number) {
  const taskX = xForDate(dateValue(task.start), chartStart, scale, cellWidth);
  return Math.max(0, taskX - Math.max(cellWidth, viewportWidth / 2));
}

export function projectRangeScrollLeft(projectStart: string, projectEnd: string, chartStart: Date, scale: TimelineScale, cellWidth: number, viewportWidth: number) {
  const startX = xForDate(dateValue(projectStart), chartStart, scale, cellWidth);
  const endX = xForDate(dateValue(projectEnd), chartStart, scale, cellWidth) + cellWidth;
  const rangeWidth = Math.max(cellWidth, endX - startX);
  const availablePadding = Math.max(0, viewportWidth - rangeWidth);
  return Math.max(0, startX - availablePadding / 2);
}

export function dateScrollLeft(targetDate: string, chartStart: Date, scale: TimelineScale, cellWidth: number, viewportWidth: number) {
  const targetX = xForDate(dateValue(targetDate), chartStart, scale, cellWidth);
  return Math.max(0, targetX - Math.max(cellWidth, viewportWidth / 2));
}

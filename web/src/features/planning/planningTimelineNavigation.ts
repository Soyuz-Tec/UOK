import { dateValue, xForDate, type TimelineScale } from "./planningGanttModel";
import type { PlanningTask } from "./types";

export function selectedTaskScrollLeft(task: PlanningTask, chartStart: Date, scale: TimelineScale, cellWidth: number, viewportWidth: number) {
  const taskX = xForDate(dateValue(task.start), chartStart, scale, cellWidth);
  return Math.max(0, taskX - Math.max(cellWidth, viewportWidth / 2));
}

import { isoDate, type TimelineScale } from "./planningGanttModel";
import type { PlanningTask } from "./types";

export type TimelineCreateDraft = {
  x: number;
  width: number;
  start: string;
  end: string;
};

export function timelineCreateDraft(startX: number, currentX: number, chartStart: Date, scale: TimelineScale, cellWidth: number): TimelineCreateDraft {
  const left = Math.max(0, Math.min(startX, currentX));
  const right = Math.max(left + 1, Math.max(startX, currentX));
  const startCell = Math.floor(left / cellWidth);
  const endCell = Math.max(startCell, Math.ceil(right / cellWidth) - 1);
  return {
    x: left,
    width: right - left,
    start: isoDate(addScaleUnits(chartStart, startCell, scale)),
    end: isoDate(addScaleUnits(chartStart, endCell, scale)),
  };
}

export function timelineTaskPayload(tasks: PlanningTask[], start: string, end: string) {
  const nextSortOrder = Math.max(0, ...tasks.map((task) => task.sort_order)) + 1;
  return {
    title: "Timeline task",
    start,
    end,
    progress: 0,
    status: "planned",
    sort_order: nextSortOrder,
    task_type: "task",
    parent_task_id: undefined,
  };
}

function addScaleUnits(start: Date, units: number, scale: TimelineScale) {
  const next = new Date(start);
  next.setDate(next.getDate() + units * unitDays(scale));
  return next;
}

function unitDays(scale: TimelineScale) {
  if (scale === "minute") return 1 / 48;
  if (scale === "hour") return 0.25;
  if (scale === "sprint") return 14;
  if (scale === "stage") return 30;
  if (scale === "year") return 365;
  if (scale === "quarter") return 91;
  if (scale === "month") return 30;
  if (scale === "week") return 7;
  return 1;
}

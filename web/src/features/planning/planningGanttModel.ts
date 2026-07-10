import type { PlanningSchedule, PlanningTask } from "./types";
import type { ViewDensity } from "./planningTimelineModel";
import {
  addUnit,
  cellWidth,
  dragDeltaDays,
  endOfUnit,
  groupLabel,
  startOfUnit,
  timelineScales,
  unitDays,
  unitKey,
  unitLabel,
  unitMs,
  type TimelineScale,
  type TimelineUnit,
} from "./planningTimelineScaleModel";

export { timelineScales, type TimelineScale, type TimelineUnit } from "./planningTimelineScaleModel";
export type PlanningGridColumn = {
  id: string;
  label: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  pinned?: boolean;
  resizable?: boolean;
};
export type DragState = {
  taskId: string;
  startX: number;
  mode: "move" | "resize-start" | "resize-end" | "progress";
  barWidth?: number;
};
export type TaskStatusIndicator = {
  code: string;
  label: string;
};

export function buildTimeline(schedule: PlanningSchedule, scale: TimelineScale, viewDensity: ViewDensity, minVisibleWidth = 0, zoom = 1) {
  const start = startOfUnit(dateValue(schedule.project.start), scale);
  const end = addUnit(endOfUnit(dateValue(schedule.project.end), scale), scale);
  const holidays = calendarExcludedDates(schedule);
  const units: TimelineUnit[] = [];
  const width = cellWidth(scale, viewDensity, zoom);
  const minUnits = Math.max(1, Math.ceil(minVisibleWidth / width));
  let cursor = new Date(start);
  while (cursor <= end || units.length < minUnits) {
    units.push(timelineUnit(cursor, scale, holidays));
    cursor = addUnit(cursor, scale);
  }
  return { start, units, cellWidth: width };
}

function calendarExcludedDates(schedule: PlanningSchedule) {
  const values = new Set(schedule.calendar?.holidays || []);
  for (const period of schedule.calendar?.ignored_periods || []) {
    let current = dateValue(period.start);
    const end = dateValue(period.end);
    while (current <= end) {
      values.add(isoDate(current));
      current = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1);
    }
  }
  return values;
}

function timelineUnit(cursor: Date, scale: TimelineScale, holidays: Set<string>): TimelineUnit {
  return {
    key: unitKey(cursor, scale),
    label: unitLabel(cursor, scale),
    group: groupLabel(cursor, scale),
    date: new Date(cursor),
    weekend: cursor.getDay() === 0 || cursor.getDay() === 6,
    holiday: holidays.has(isoDate(cursor)),
  };
}

export function gridColumns(fieldPreset: "core" | "progress" | "resources"): PlanningGridColumn[] {
  const base = [gridColumn("wbs", "WBS", 64, 52, 120, true), gridColumn("task", "Task", 240, 150, 520, true)];
  if (fieldPreset === "progress") return [...base, gridColumn("duration", "Dur.", 84, 68, 140), gridColumn("progress", "%", 76, 64, 130), gridColumn("critical", "Critical", 104, 82, 160)];
  if (fieldPreset === "resources") return [...base, gridColumn("assigned", "Assigned", 180, 130, 360), gridColumn("status", "Status", 116, 90, 180)];
  return [...base, gridColumn("start", "Start", 116, 90, 170), gridColumn("end", "End", 116, 90, 170)];
}

export function gridValue(columnId: string, task: PlanningTask, assignedByTask: Map<string, string>) {
  if (columnId === "wbs") return task.wbs || "-";
  if (columnId === "task") return task.title;
  if (columnId === "start") return task.start;
  if (columnId === "end") return task.end;
  if (columnId === "duration") return String(task.duration_days);
  if (columnId === "progress") return `${task.progress}%`;
  if (columnId === "critical") return task.critical ? "yes" : "-";
  if (columnId === "assigned") return assignedByTask.get(task.id) || "-";
  if (columnId === "status") return task.status || "-";
  return "-";
}

export function autoFitColumnWidth(column: PlanningGridColumn, tasks: PlanningTask[], assignedByTask: Map<string, string>) {
  const values = [column.label, ...tasks.map((task) => gridValue(column.id, task, assignedByTask))];
  const longest = Math.max(...values.map((value) => String(value).length));
  return Math.min(Math.max(longest * 8 + 36, column.minWidth), column.maxWidth);
}

export function assignedResourceNames(schedule: PlanningSchedule) {
  const resources = new Map(schedule.resources.map((resource) => [resource.id, resource.name]));
  const namesByTask = new Map<string, string[]>();
  for (const assignment of schedule.assignments) {
    const resourceName = resources.get(assignment.resource_id);
    if (!resourceName) continue;
    const names = namesByTask.get(assignment.task_id) || [];
    names.push(resourceName);
    namesByTask.set(assignment.task_id, names);
  }
  return new Map(Array.from(namesByTask.entries()).map(([taskId, names]) => [taskId, names.join(", ")]));
}

export function finishDrag(
  clientX: number,
  drag: DragState,
  cellWidth: number,
  scale: TimelineScale,
  tasks: PlanningTask[],
  onTaskReschedule: (taskId: string, start: string, end: string) => void,
  onTaskProgress: (taskId: string, progress: number) => void
) {
  const task = tasks.find((row) => row.id === drag.taskId);
  if (!task) return;
  if (drag.mode === "progress") {
    const barWidth = Math.max(drag.barWidth || cellWidth, 1);
    const nextProgress = Math.round(Math.max(0, Math.min(100, task.progress + ((clientX - drag.startX) / barWidth) * 100)));
    if (nextProgress !== task.progress) onTaskProgress(task.id, nextProgress);
    return;
  }
  const deltaCells = Math.round((clientX - drag.startX) / cellWidth);
  if (!deltaCells) return;
  const deltaDays = dragDeltaDays(deltaCells, scale);
  if (!deltaDays) return;
  const currentStart = dateValue(task.start);
  const currentEnd = dateValue(task.end);
  if (drag.mode === "resize-start") {
    const nextStart = addDays(currentStart, deltaDays);
    onTaskReschedule(task.id, isoDate(nextStart > currentEnd ? currentEnd : nextStart), task.end);
  } else if (drag.mode === "resize-end") {
    const nextEnd = addDays(currentEnd, deltaDays);
    onTaskReschedule(task.id, task.start, isoDate(nextEnd < currentStart ? currentStart : nextEnd));
  } else {
    onTaskReschedule(task.id, isoDate(addDays(currentStart, deltaDays)), isoDate(addDays(currentEnd, deltaDays)));
  }
}

export function rowHeight(viewDensity: ViewDensity) {
  if (viewDensity === "compact") return 42;
  if (viewDensity === "roomy") return 56;
  return 50;
}

export function taskColorClass(task: PlanningTask) {
  if (task.progress >= 100 || task.status === "complete") return "complete";
  if (dateValue(task.end) < today() && task.progress < 100) return "overdue";
  if (task.status === "blocked") return "blocked";
  if (task.progress > 0) return "in-progress";
  return "not-started";
}

export function taskStatusIndicator(task: PlanningTask, showCritical = false): TaskStatusIndicator {
  if (showCritical && task.critical) return { code: "CRIT", label: "Critical path task" };
  const status = taskColorClass(task);
  if (status === "complete") return { code: "DONE", label: "Complete task" };
  if (status === "overdue") return { code: "LATE", label: "Overdue task" };
  if (status === "blocked") return { code: "HOLD", label: "Blocked task" };
  if (status === "in-progress") return { code: "WORK", label: "In progress task" };
  return { code: "OPEN", label: "Not started task" };
}

export function xForDate(date: Date, start: Date, scale: TimelineScale, cellWidth: number) {
  return Math.round((date.getTime() - start.getTime()) / unitMs(scale)) * cellWidth;
}

export function durationUnits(task: PlanningTask, scale: TimelineScale) {
  return Math.max(1, Math.ceil((dateDiffDays(dateValue(task.start), dateValue(task.end)) + 1) / unitDays(scale)));
}

export function durationBetween(start: string, end: string, scale: TimelineScale) {
  return Math.max(1, Math.ceil((dateDiffDays(dateValue(start), dateValue(end)) + 1) / unitDays(scale)));
}

export function dateValue(value: string) {
  return new Date(`${value}T00:00:00`);
}

export function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateDiffDays(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

function gridColumn(id: string, label: string, defaultWidth: number, minWidth: number, maxWidth: number, pinned = false): PlanningGridColumn {
  return { id, label, defaultWidth, minWidth, maxWidth, pinned };
}

function today() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
}

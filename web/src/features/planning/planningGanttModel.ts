import type { PlanningSchedule, PlanningTask } from "./types";
import type { ViewDensity } from "./planningTimelineModel";

export type TimelineScale = "day" | "week" | "month";
export type PlanningGridColumn = {
  id: string;
  label: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  resizable?: boolean;
};
export type TimelineUnit = {
  key: string;
  label: string;
  group: string;
  date: Date;
  weekend: boolean;
  holiday: boolean;
};
export type DragState = {
  taskId: string;
  startX: number;
};

export function buildTimeline(schedule: PlanningSchedule, scale: TimelineScale, viewDensity: ViewDensity) {
  const start = startOfUnit(dateValue(schedule.project.start), scale);
  const end = addDays(endOfUnit(dateValue(schedule.project.end), scale), unitDays(scale));
  const holidays = new Set(schedule.calendar?.holidays || []);
  const units: TimelineUnit[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, unitDays(scale))) {
    units.push({
      key: isoDate(cursor),
      label: unitLabel(cursor, scale),
      group: groupLabel(cursor, scale),
      date: new Date(cursor),
      weekend: cursor.getDay() === 0 || cursor.getDay() === 6,
      holiday: holidays.has(isoDate(cursor)),
    });
  }
  return { start, units, cellWidth: scale === "month" ? 120 : scale === "week" ? 92 : viewDensity === "compact" ? 44 : 52 };
}

export function visibleRows(tasks: PlanningTask[], summaryExpanded: boolean) {
  if (summaryExpanded) return tasks;
  const collapsedParents = new Set(tasks.filter((task) => task.task_type === "summary").map((task) => task.id));
  return tasks.filter((task) => !task.parent_task_id || !collapsedParents.has(task.parent_task_id));
}

export function gridColumns(fieldPreset: "core" | "progress" | "resources"): PlanningGridColumn[] {
  const base = [gridColumn("wbs", "WBS", 64, 52, 120), gridColumn("task", "Task", 240, 150, 520)];
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

export function finishDrag(clientX: number, drag: DragState, cellWidth: number, scale: TimelineScale, tasks: PlanningTask[], onTaskReschedule: (taskId: string, start: string, end: string) => void) {
  const task = tasks.find((row) => row.id === drag.taskId);
  if (!task) return;
  const deltaCells = Math.round((clientX - drag.startX) / cellWidth);
  if (!deltaCells) return;
  const deltaDays = deltaCells * unitDays(scale);
  onTaskReschedule(task.id, isoDate(addDays(dateValue(task.start), deltaDays)), isoDate(addDays(dateValue(task.end), deltaDays)));
}

export function rowHeight(viewDensity: ViewDensity) {
  if (viewDensity === "compact") return 42;
  if (viewDensity === "roomy") return 56;
  return 50;
}

export function taskColorClass(task: PlanningTask) {
  if (task.progress >= 100 || task.status === "complete" || task.status === "completed") return "complete";
  if (dateValue(task.end) < today() && task.progress < 100) return "overdue";
  if (task.status === "blocked") return "blocked";
  if (task.progress > 0) return "in-progress";
  return "not-started";
}

export function xForDate(date: Date, start: Date, scale: TimelineScale, cellWidth: number) {
  return Math.round(dateDiffDays(start, date) / unitDays(scale)) * cellWidth;
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

function unitDays(scale: TimelineScale) {
  if (scale === "month") return 30;
  if (scale === "week") return 7;
  return 1;
}

function unitLabel(date: Date, scale: TimelineScale) {
  if (scale === "month") return date.toLocaleString("en-US", { month: "short" });
  if (scale === "week") return `W${weekNumber(date)}`;
  return String(date.getDate());
}

function groupLabel(date: Date, scale: TimelineScale) {
  if (scale === "month") return String(date.getFullYear());
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function startOfUnit(date: Date, scale: TimelineScale) {
  const next = new Date(date);
  if (scale === "week") next.setDate(next.getDate() - next.getDay());
  if (scale === "month") next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfUnit(date: Date, scale: TimelineScale) {
  const next = new Date(date);
  if (scale === "week") next.setDate(next.getDate() + (6 - next.getDay()));
  if (scale === "month") next.setMonth(next.getMonth() + 1, 0);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateDiffDays(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

function weekNumber(value: Date) {
  const first = new Date(value.getFullYear(), 0, 1);
  return Math.ceil((((value.getTime() - first.getTime()) / 86_400_000) + first.getDay() + 1) / 7);
}

function gridColumn(id: string, label: string, defaultWidth: number, minWidth: number, maxWidth: number): PlanningGridColumn {
  return { id, label, defaultWidth, minWidth, maxWidth };
}

function today() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
}

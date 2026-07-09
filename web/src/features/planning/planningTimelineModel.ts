import type { PlanningSchedule, PlanningTask } from "./types";

export const planningViews = ["Gantt chart", "Board", "List", "Calendar", "Workload", "People", "Dashboard"] as const;
export type PlanningView = typeof planningViews[number];
export type FieldPreset = "core" | "progress" | "resources";
export type FilterMode = "all" | "critical" | "milestones";
export type ViewDensity = "compact" | "standard" | "roomy";

export function projectScheduleView(schedule: PlanningSchedule, filterMode: FilterMode, cascadeSort: boolean): PlanningSchedule {
  const sorted = [...schedule.tasks].sort((a, b) => cascadeSort ? compareWbs(a, b) : a.sort_order - b.sort_order);
  const taskMap = new Map(sorted.map((task) => [task.id, task]));
  const included = new Set<string>();
  for (const task of sorted) {
    if (taskMatchesFilter(task, filterMode)) {
      included.add(task.id);
      let parentId = task.parent_task_id || "";
      while (parentId) {
        included.add(parentId);
        parentId = taskMap.get(parentId)?.parent_task_id || "";
      }
    }
  }
  const tasks = sorted.filter((task) => included.has(task.id));
  const visibleIds = new Set(tasks.map((task) => task.id));
  return {
    ...schedule,
    tasks,
    dependencies: schedule.dependencies.filter((dependency) => visibleIds.has(dependency.predecessor_task_id) && visibleIds.has(dependency.successor_task_id)),
  };
}

export function exportScheduleCsv(schedule: PlanningSchedule) {
  const header = ["WBS", "Task", "Type", "Status", "Start", "End", "Progress", "Critical"];
  const rows = schedule.tasks.map((task) => [task.wbs || "", task.title, task.task_type, task.status, task.start, task.end, `${task.progress}`, task.critical ? "yes" : "no"]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${schedule.project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-schedule.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function taskMatchesFilter(task: PlanningTask, filterMode: FilterMode) {
  if (filterMode === "critical") return task.critical || task.task_type === "summary";
  if (filterMode === "milestones") return task.task_type === "milestone" || task.task_type === "summary";
  return true;
}

function compareWbs(a: PlanningTask, b: PlanningTask) {
  return String(a.wbs || a.sort_order).localeCompare(String(b.wbs || b.sort_order), undefined, { numeric: true, sensitivity: "base" });
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

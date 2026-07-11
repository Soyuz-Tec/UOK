import type { PlanningSchedule, PlanningTask } from "./types";

export const planningViews = ["Gantt chart", "Board", "List", "Calendar", "Workload", "People", "Dashboard"] as const;
export type PlanningView = typeof planningViews[number];
export type FieldPreset = "core" | "progress" | "resources";
export type FilterMode = "all" | "critical" | "milestones" | "not_ready";
export type PlanningLayoutMode = "split" | "timeline";
export type ViewDensity = "compact" | "standard" | "roomy";
export type PlanningFilterState = {
  mode: FilterMode;
  query: string;
  partyId: string;
  resourceId: string;
  status: string;
};

export function planningColumnVisibilityOptions(fieldPreset: FieldPreset) {
  const base = [{ id: "wbs", label: "WBS", locked: true }, { id: "task", label: "Task", locked: true }];
  if (fieldPreset === "progress") return [...base, { id: "duration", label: "Duration" }, { id: "progress", label: "Progress" }, { id: "critical", label: "Critical" }];
  if (fieldPreset === "resources") return [...base, { id: "assigned", label: "Assigned" }, { id: "status", label: "Status" }];
  return [...base, { id: "start", label: "Start" }, { id: "end", label: "End" }];
}

export function projectScheduleView(schedule: PlanningSchedule, filterState: PlanningFilterState, cascadeSort: boolean): PlanningSchedule {
  const sorted = [...schedule.tasks].sort((a, b) => cascadeSort ? compareWbs(a, b) : a.sort_order - b.sort_order);
  const taskMap = new Map(sorted.map((task) => [task.id, task]));
  const resourceTaskIds = new Set(schedule.assignments.filter((assignment) => assignment.resource_id === filterState.resourceId).map((assignment) => assignment.task_id));
  const included = new Set<string>();
  for (const task of sorted) {
    if (taskMatchesFilter(task, filterState, resourceTaskIds)) {
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

function taskMatchesFilter(task: PlanningTask, filterState: PlanningFilterState, resourceTaskIds: Set<string>) {
  if (filterState.mode === "critical" && !task.critical) return false;
  if (filterState.mode === "milestones" && task.task_type !== "milestone") return false;
  if (filterState.mode === "not_ready" && task.readiness?.ready !== false) return false;
  if (filterState.status && (task.status || "planned") !== filterState.status) return false;
  if (filterState.partyId && !(task.participant_ids || []).includes(filterState.partyId)) return false;
  if (filterState.resourceId && !resourceTaskIds.has(task.id)) return false;
  const query = filterState.query.trim().toLocaleLowerCase();
  if (query && !`${task.wbs || ""} ${task.title}`.toLocaleLowerCase().includes(query)) return false;
  return true;
}

function compareWbs(a: PlanningTask, b: PlanningTask) {
  return String(a.wbs || a.sort_order).localeCompare(String(b.wbs || b.sort_order), undefined, { numeric: true, sensitivity: "base" });
}

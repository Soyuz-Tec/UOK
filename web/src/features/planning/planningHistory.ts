import type { PlanningAssignment, PlanningCalendar, PlanningDependency, PlanningSchedule, PlanningTask } from "./types";
import type {
  PlanningAssignmentCreateRequest,
  PlanningCalendarUpdateRequest,
  PlanningDependencyCreateRequest,
  PlanningDependencyUpdateRequest,
  PlanningTaskCreateRequest,
  PlanningTaskUpdateRequest,
} from "./planningContracts";

export type PlanningHistoryStep =
  | { kind: "update-task"; taskId: string; payload: PlanningTaskUpdateRequest }
  | { kind: "create-task"; projectId: string; payload: PlanningTaskCreateRequest }
  | { kind: "delete-task"; taskId?: string; match: Record<string, unknown> }
  | { kind: "update-dependency"; dependencyId: string; payload: PlanningDependencyUpdateRequest }
  | { kind: "create-dependency"; projectId: string; payload: PlanningDependencyCreateRequest }
  | { kind: "remove-dependency"; dependencyId?: string; match: Record<string, unknown> }
  | { kind: "set-calendar"; projectId: string; payload: PlanningCalendarUpdateRequest }
  | { kind: "assign-resource"; payload: PlanningAssignmentCreateRequest }
  | { kind: "level-resources"; projectId: string };

export type PlanningHistoryEntry = {
  label: string;
  undo: PlanningHistoryStep[];
  redo: PlanningHistoryStep[];
};

export type PlanningHistoryState = {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string;
  redoLabel: string;
};

export function planningHistoryDiff(before: PlanningSchedule, after: PlanningSchedule, label: string): PlanningHistoryEntry | null {
  if (before.project.id !== after.project.id) return null;
  if (!removedTasksAreReversible(before, after)) return null;
  const undo: PlanningHistoryStep[] = [];
  const redo: PlanningHistoryStep[] = [];
  addTaskDiff(before, after, undo, redo);
  addDependencyDiff(before, after, undo, redo);
  addCalendarDiff(before, after, undo, redo);
  if (!addAssignmentDiff(before, after, undo, redo)) return null;
  return undo.length || redo.length ? { label, undo, redo } : null;
}

export function planningLevelHistory(before: PlanningSchedule, after: PlanningSchedule): PlanningHistoryEntry | null {
  const changed = after.tasks.filter((task) => {
    const previous = before.tasks.find((item) => item.id === task.id);
    return previous && (previous.start !== task.start || previous.end !== task.end);
  });
  if (!changed.length) return null;
  return {
    label: "Level resources",
    undo: changed.map((task) => ({ kind: "update-task", taskId: task.id, payload: taskUpdatePayload(before.tasks.find((item) => item.id === task.id) as PlanningTask) })),
    redo: [{ kind: "level-resources", projectId: after.project.id }],
  };
}

export function taskUpdatePayload(task: PlanningTask): PlanningTaskUpdateRequest {
  return cleanPayload({
    title: task.title,
    task_type: task.task_type,
    parent_task_id: task.parent_task_id || null,
    status: task.status,
    start: task.start,
    end: task.end,
    progress: task.progress,
    sort_order: task.sort_order,
    scheduling_mode: task.scheduling_mode || "auto",
    constraint_type: task.constraint_type || null,
    constraint_date: task.constraint_date || null,
    cascade: false,
  });
}

export function taskCreatePayload(task: PlanningTask): PlanningTaskCreateRequest {
  const payload = { ...taskUpdatePayload(task) } as PlanningTaskCreateRequest & { cascade?: boolean };
  delete payload.cascade;
  return payload;
}

export function dependencyPayload(dep: PlanningDependency) {
  return {
    predecessor_task_id: dep.predecessor_task_id,
    successor_task_id: dep.successor_task_id,
    dependency_type: dep.dependency_type,
    lag_days: dep.lag_days,
  };
}

export function calendarPayload(calendar: PlanningCalendar | undefined) {
  return {
    name: calendar?.name || "Standard",
    working_days: calendar?.working_days || [1, 2, 3, 4, 5],
    holidays: calendar?.holidays || [],
    ignored_periods: (calendar?.ignored_periods || []).map((period) => `${period.start}..${period.end}`),
  };
}

export function assignmentPayload(assignment: PlanningAssignment) {
  return {
    task_id: assignment.task_id,
    resource_id: assignment.resource_id,
    allocation_percent: assignment.allocation_percent,
  };
}

export function findTaskByMatch(schedule: PlanningSchedule, match: Record<string, unknown>) {
  return schedule.tasks.find((task) => Object.entries(match).every(([key, value]) => String(task[key as keyof PlanningTask] ?? "") === String(value ?? "")));
}

export function findDependencyByMatch(schedule: PlanningSchedule, match: Record<string, unknown>) {
  return schedule.dependencies.find((dep) => Object.entries(match).every(([key, value]) => String(dep[key as keyof PlanningDependency] ?? "") === String(value ?? "")));
}

function addTaskDiff(before: PlanningSchedule, after: PlanningSchedule, undo: PlanningHistoryStep[], redo: PlanningHistoryStep[]) {
  const beforeById = new Map(before.tasks.map((task) => [task.id, task]));
  const afterById = new Map(after.tasks.map((task) => [task.id, task]));
  for (const task of after.tasks) {
    const previous = beforeById.get(task.id);
    if (!previous) {
      const match = taskMatch(task);
      undo.push({ kind: "delete-task", taskId: task.id, match });
      redo.push({ kind: "create-task", projectId: after.project.id, payload: taskCreatePayload(task) });
    } else if (taskFingerprint(previous) !== taskFingerprint(task)) {
      undo.push({ kind: "update-task", taskId: task.id, payload: taskUpdatePayload(previous) });
      redo.push({ kind: "update-task", taskId: task.id, payload: taskUpdatePayload(task) });
    }
  }
  for (const task of before.tasks) {
    if (afterById.has(task.id)) continue;
    undo.push({ kind: "create-task", projectId: before.project.id, payload: taskCreatePayload(task) });
    redo.push({ kind: "delete-task", taskId: task.id, match: taskMatch(task) });
  }
}

function addDependencyDiff(before: PlanningSchedule, after: PlanningSchedule, undo: PlanningHistoryStep[], redo: PlanningHistoryStep[]) {
  const beforeById = new Map(before.dependencies.map((dep) => [dep.id, dep]));
  const afterById = new Map(after.dependencies.map((dep) => [dep.id, dep]));
  for (const dep of after.dependencies) {
    const previous = beforeById.get(dep.id);
    if (!previous) {
      undo.push({ kind: "remove-dependency", dependencyId: dep.id, match: dependencyPayload(dep) });
      redo.push({ kind: "create-dependency", projectId: after.project.id, payload: dependencyPayload(dep) });
    } else if (dependencyFingerprint(previous) !== dependencyFingerprint(dep)) {
      undo.push({ kind: "update-dependency", dependencyId: dep.id, payload: dependencyPayload(previous) });
      redo.push({ kind: "update-dependency", dependencyId: dep.id, payload: dependencyPayload(dep) });
    }
  }
  for (const dep of before.dependencies) {
    if (afterById.has(dep.id)) continue;
    undo.push({ kind: "create-dependency", projectId: before.project.id, payload: dependencyPayload(dep) });
    redo.push({ kind: "remove-dependency", dependencyId: dep.id, match: dependencyPayload(dep) });
  }
}

function addCalendarDiff(before: PlanningSchedule, after: PlanningSchedule, undo: PlanningHistoryStep[], redo: PlanningHistoryStep[]) {
  if (JSON.stringify(calendarPayload(before.calendar)) === JSON.stringify(calendarPayload(after.calendar))) return;
  undo.push({ kind: "set-calendar", projectId: before.project.id, payload: calendarPayload(before.calendar) });
  redo.push({ kind: "set-calendar", projectId: after.project.id, payload: calendarPayload(after.calendar) });
}

function addAssignmentDiff(before: PlanningSchedule, after: PlanningSchedule, undo: PlanningHistoryStep[], redo: PlanningHistoryStep[]) {
  const beforeById = new Map(before.assignments.map((assignment) => [assignment.id, assignment]));
  const afterById = new Map(after.assignments.map((assignment) => [assignment.id, assignment]));
  for (const assignment of after.assignments) {
    const previous = beforeById.get(assignment.id);
    if (!previous) return false;
    if (previous.allocation_percent !== assignment.allocation_percent) {
      undo.push({ kind: "assign-resource", payload: assignmentPayload(previous) });
      redo.push({ kind: "assign-resource", payload: assignmentPayload(assignment) });
    }
  }
  return before.assignments.every((assignment) => afterById.has(assignment.id));
}

function removedTasksAreReversible(before: PlanningSchedule, after: PlanningSchedule) {
  const afterIds = new Set(after.tasks.map((task) => task.id));
  const removed = new Set(before.tasks.filter((task) => !afterIds.has(task.id)).map((task) => task.id));
  if (!removed.size) return true;
  return !before.dependencies.some((dep) => removed.has(dep.predecessor_task_id) || removed.has(dep.successor_task_id))
    && !before.assignments.some((assignment) => removed.has(assignment.task_id));
}

function cleanPayload<T extends object>(payload: T): T {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)) as T;
}

function taskMatch(task: PlanningTask) {
  return { title: task.title, start: task.start, end: task.end, sort_order: task.sort_order };
}

function taskFingerprint(task: PlanningTask) {
  return JSON.stringify(taskUpdatePayload(task));
}

function dependencyFingerprint(dep: PlanningDependency) {
  return JSON.stringify(dependencyPayload(dep));
}

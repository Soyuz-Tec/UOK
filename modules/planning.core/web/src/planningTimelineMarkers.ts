import type { PlanningTask } from "./types";

export type PlanningTimelineMarker = {
  id: string;
  taskId: string;
  date: string;
  code: "DUE" | "MS" | "VAR";
  label: string;
  kind: "deadline" | "milestone" | "variance";
};

export function taskTimelineMarkers(tasks: PlanningTask[]) {
  return tasks
    .filter((task) => task.task_type !== "summary")
    .filter((task) => task.critical || task.task_type === "milestone" || hasEndVariance(task))
    .map((task) => markerForTask(task))
    .sort((left, right) => left.date.localeCompare(right.date) || left.label.localeCompare(right.label));
}

function markerForTask(task: PlanningTask): PlanningTimelineMarker {
  if (task.task_type === "milestone") {
    return marker(task, "MS", "milestone", `Milestone: ${task.title}`);
  }
  if (hasEndVariance(task)) {
    return marker(task, "VAR", "variance", `Baseline variance: ${task.title}`);
  }
  return marker(task, "DUE", "deadline", `Deadline: ${task.title}`);
}

function marker(task: PlanningTask, code: PlanningTimelineMarker["code"], kind: PlanningTimelineMarker["kind"], label: string) {
  return { id: `${kind}-${task.id}`, taskId: task.id, date: task.end, code, kind, label };
}

function hasEndVariance(task: PlanningTask) {
  return typeof task.end_variance_days === "number" && task.end_variance_days > 0;
}

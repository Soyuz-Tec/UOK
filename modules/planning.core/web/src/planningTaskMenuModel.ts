import type { PlanningTask } from "./types";
import type { PlanningTaskCreateRequest, PlanningTaskUpdateRequest } from "./planningContracts";

export type PlanningTaskMenuAction = "add-below" | "add-child" | "duplicate" | "convert-milestone" | "mark-complete" | "mark-blocked" | "mark-planned" | "delete";

export type PlanningTaskMenuMutation =
  | { kind: "create"; payload: PlanningTaskCreateRequest }
  | { kind: "update"; taskId: string; payload: PlanningTaskUpdateRequest }
  | { kind: "delete"; taskId: string };

export function planningTaskMenuMutation(action: PlanningTaskMenuAction, task: PlanningTask): PlanningTaskMenuMutation | null {
  if (action === "delete") return { kind: "delete", taskId: task.id };
  if (action === "mark-complete") return { kind: "update", taskId: task.id, payload: { status: "complete", progress: 100 } };
  if (action === "mark-blocked") return { kind: "update", taskId: task.id, payload: { status: "blocked" } };
  if (action === "mark-planned") return { kind: "update", taskId: task.id, payload: { status: "planned" } };
  if (action === "convert-milestone") {
    if (task.task_type !== "task") return null;
    return { kind: "update", taskId: task.id, payload: { task_type: "milestone", end: task.start } };
  }
  if (action === "add-child") {
    if (task.task_type !== "summary") return null;
    return { kind: "create", payload: taskPayload(`New task under ${task.title}`, task.start, task.end, task.sort_order + 1, "task", task.id) };
  }
  if (action === "duplicate") {
    return { kind: "create", payload: taskPayload(`${task.title} copy`, task.start, task.end, task.sort_order + 1, task.task_type, task.parent_task_id || undefined, task.status, task.progress) };
  }
  return { kind: "create", payload: taskPayload("New task", task.start, task.end, task.sort_order + 1, "task", task.parent_task_id || undefined) };
}

function taskPayload(
  title: string,
  start: string,
  end: string,
  sortOrder: number,
  taskType: NonNullable<PlanningTaskCreateRequest["task_type"]>,
  parentTaskId?: string,
  status: PlanningTask["status"] = "planned",
  progress = 0,
): PlanningTaskCreateRequest {
  return { title, start, end, progress, status, sort_order: sortOrder, task_type: taskType, parent_task_id: parentTaskId };
}

import type { PlanningTask } from "./types";
import type { PlanningTaskMenuAction } from "./planningTaskMenuModel";

export type PlanningKeyboardCommand =
  | { kind: "none" }
  | { kind: "select"; taskId: string }
  | { kind: "open-menu" }
  | { kind: "task-action"; action: PlanningTaskMenuAction }
  | { kind: "toggle-summary" };

export function planningKeyboardCommand(event: Pick<KeyboardEvent, "ctrlKey" | "key" | "metaKey" | "shiftKey">, task: PlanningTask, tasks: PlanningTask[]): PlanningKeyboardCommand {
  if (event.key === "ArrowDown") return taskSelection(task.id, tasks, 1);
  if (event.key === "ArrowUp") return taskSelection(task.id, tasks, -1);
  if (event.key === "Home") return tasks[0] ? { kind: "select", taskId: tasks[0].id } : { kind: "none" };
  if (event.key === "End") return tasks.at(-1) ? { kind: "select", taskId: tasks.at(-1)!.id } : { kind: "none" };
  if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) return { kind: "open-menu" };
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) return { kind: "task-action", action: "mark-complete" };
  if (event.key === "Enter" || event.key === " ") return task.task_type === "summary" ? { kind: "toggle-summary" } : { kind: "select", taskId: task.id };
  if (!(event.ctrlKey || event.metaKey)) return { kind: "none" };
  const key = event.key.toLowerCase();
  if (key === "d") return { kind: "task-action", action: "duplicate" };
  if (key === "b") return { kind: "task-action", action: "mark-blocked" };
  if (key === "m") return { kind: "task-action", action: "convert-milestone" };
  if (key === "n") return { kind: "task-action", action: event.shiftKey ? "add-child" : "add-below" };
  return { kind: "none" };
}

function taskSelection(taskId: string, tasks: PlanningTask[], offset: number): PlanningKeyboardCommand {
  const index = tasks.findIndex((task) => task.id === taskId);
  const next = tasks[Math.max(0, Math.min(tasks.length - 1, index + offset))];
  return next ? { kind: "select", taskId: next.id } : { kind: "none" };
}

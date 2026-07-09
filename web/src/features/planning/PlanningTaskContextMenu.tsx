import { Ban, CheckCircle2, Copy, Flag, Milestone, Plus, Rows3, Trash2 } from "lucide-react";

import { WorkspaceContextMenu, type WorkspaceContextMenuItem } from "../../shared/overlays";
import type { PlanningTask } from "./types";
import type { PlanningTaskMenuAction } from "./planningTaskMenuModel";

export function PlanningTaskContextMenu({
  onAction,
  onClose,
  open,
  position,
  task,
}: {
  onAction: (action: PlanningTaskMenuAction, task: PlanningTask) => void;
  onClose: () => void;
  open: boolean;
  position: { x: number; y: number };
  task: PlanningTask | null;
}) {
  if (!task) return null;
  return (
    <WorkspaceContextMenu
      label={`Task actions for ${task.title}`}
      open={open}
      position={position}
      onClose={onClose}
      items={taskMenuItems(task, (action) => onAction(action, task))}
    />
  );
}

function taskMenuItems(task: PlanningTask, run: (action: PlanningTaskMenuAction) => void): WorkspaceContextMenuItem[] {
  return [
    item("add-below", "Add task below", "Create a sibling task", Plus, run),
    item("add-child", "Add child task", "Create under this summary", Rows3, run, task.task_type !== "summary"),
    item("duplicate", "Duplicate task", "Copy dates, type, and status", Copy, run),
    item("convert-milestone", "Convert to milestone", "Use the start date as the marker", Milestone, run, task.task_type !== "task"),
    item("mark-complete", "Mark complete", "Set status and progress", CheckCircle2, run),
    item("mark-blocked", "Mark blocked", "Flag schedule risk", Ban, run),
    item("mark-planned", "Mark planned", "Return to planned state", Flag, run),
    item("delete", "Delete task", "Remove this task", Trash2, run, false, true),
  ];
}

function item(id: PlanningTaskMenuAction, label: string, description: string, icon: WorkspaceContextMenuItem["icon"], run: (action: PlanningTaskMenuAction) => void, disabled = false, destructive = false): WorkspaceContextMenuItem {
  return { id, label, description, icon, disabled, destructive, onSelect: () => run(id) };
}

import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";

import { InlineTextEdit } from "../../shared/forms";
import { gridValue, type PlanningGridColumn } from "./planningGanttModel";
import { isEditablePlanningGridColumn, planningGridCellEditLabel, planningGridCellEditPayload, planningGridCellEditValidation } from "./planningGridInlineEdit";
import type { PinnedColumnOffsetMap } from "./planningPinnedColumns";
import type { PlanningTask } from "./types";

export function PlanningGanttGridCell({
  assignedByTask,
  column,
  pinnedOffsets,
  readOnly,
  task,
  onTaskEdit,
}: {
  assignedByTask: Map<string, string>;
  column: PlanningGridColumn;
  pinnedOffsets: PinnedColumnOffsetMap;
  readOnly: boolean;
  task: PlanningTask;
  onTaskEdit: (taskId: string, payload: Record<string, unknown>) => Promise<void> | void;
}) {
  const value = gridValue(column.id, task, assignedByTask);
  const editable = !readOnly && isEditablePlanningGridColumn(column.id);
  const label = planningGridCellEditLabel(column.label, task);
  return (
    <span role="cell" className={pinnedOffsets.has(column.id) ? "planning-owned-pinned-column" : undefined} style={pinnedStyle(column.id)} onClick={editable ? stopCellEvent : undefined} onKeyDown={editable ? stopCellKey : undefined}>
      {editable ? (
        <span className="planning-owned-inline-cell">
          <InlineTextEdit
            label={label}
            value={value}
            onCommit={(nextValue) => onTaskEdit(task.id, planningGridCellEditPayload(column.id, nextValue))}
            validate={(nextValue) => planningGridCellEditValidation(column.id, nextValue)}
            failureMessage="Task update failed validation."
          />
        </span>
      ) : value}
    </span>
  );

  function pinnedStyle(columnId: string): CSSProperties | undefined {
    const left = pinnedOffsets.get(columnId);
    return left === undefined ? undefined : { left };
  }
}

function stopCellEvent(event: MouseEvent) {
  event.stopPropagation();
}

function stopCellKey(event: KeyboardEvent) {
  event.stopPropagation();
}

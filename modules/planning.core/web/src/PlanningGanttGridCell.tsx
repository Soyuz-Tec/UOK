import { ChevronDown, ChevronRight } from "lucide-react";
import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";

import { InlineTextEdit } from "@uok/shared/forms";
import { useUokLocalization } from "@uok/shared/localization";
import { gridValue, type PlanningGridColumn } from "./planningGanttModel";
import type { PlanningGridTaskFacts } from "./planningGanttGridFacts";
import { isEditablePlanningGridColumn, planningGridCellEditLabel, planningGridCellEditPayload, planningGridCellEditValidation } from "./planningGridInlineEdit";
import type { PinnedColumnOffsetMap } from "./planningPinnedColumns";
import type { PlanningTask } from "./types";
import type { PlanningTaskUpdateRequest } from "./planningContracts";

export function PlanningGanttGridCell({
  assignedByTask,
  column,
  pinnedOffsets,
  readOnly,
  summaryExpanded,
  task,
  taskDepth,
  onSummaryToggle,
  onTaskEdit,
}: {
  assignedByTask: PlanningGridTaskFacts;
  column: PlanningGridColumn;
  pinnedOffsets: PinnedColumnOffsetMap;
  readOnly: boolean;
  summaryExpanded: boolean;
  task: PlanningTask;
  taskDepth: number;
  onSummaryToggle: (taskId: string) => void;
  onTaskEdit: (taskId: string, payload: PlanningTaskUpdateRequest) => Promise<void> | void;
}) {
  const { formatNumber, t } = useUokLocalization();
  const value = gridValue(column.id, task, assignedByTask, { formatNumber, t });
  const editable = !readOnly && isEditablePlanningGridColumn(column.id);
  const identityCell = column.id === "task";
  const label = planningGridCellEditLabel(column.label, task);
  const valueContent = editable ? (
    <span className="planning-owned-inline-cell">
      <InlineTextEdit
        label={label}
        value={value}
        onCommit={(nextValue) => onTaskEdit(task.id, planningGridCellEditPayload(column.id, nextValue))}
        validate={(nextValue) => planningGridCellEditValidation(column.id, nextValue)}
        failureMessage="Task update failed validation."
      />
    </span>
  ) : <span className="planning-owned-grid-cell-value" title={value === "-" ? undefined : value}>{value}</span>;
  return (
    <span role="cell" className={`${pinnedOffsets.has(column.id) ? "planning-owned-pinned-column" : ""} ${identityCell ? "planning-owned-tree-cell" : ""}`} style={pinnedStyle(column.id)} onClick={editable ? stopCellEvent : undefined} onKeyDown={editable ? stopCellKey : undefined}>
      {identityCell ? (
        <span className="planning-owned-task-identity" style={{ "--planning-task-depth": taskDepth } as CSSProperties}>
          {task.task_type === "summary" ? (
            <button
              type="button"
              className="planning-owned-summary-toggle"
              aria-label={`${summaryExpanded ? "Collapse" : "Expand"} ${task.title}`}
              aria-expanded={summaryExpanded}
              title={`${summaryExpanded ? "Collapse" : "Expand"} summary`}
              onClick={(event) => {
                event.stopPropagation();
                onSummaryToggle(task.id);
              }}
              onKeyDown={stopCellKey}
            >
              {summaryExpanded ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
            </button>
          ) : <span className="planning-owned-summary-toggle-placeholder" aria-hidden="true" />}
          {valueContent}
        </span>
      ) : valueContent}
    </span>
  );

  function pinnedStyle(columnId: string): CSSProperties | undefined {
    const left = pinnedOffsets.get(columnId);
    return left === undefined ? undefined : { "--planning-pinned-offset": `${left}px` } as CSSProperties;
  }
}

function stopCellEvent(event: MouseEvent) {
  event.stopPropagation();
}

function stopCellKey(event: KeyboardEvent) {
  event.stopPropagation();
}

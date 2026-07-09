import { MoreHorizontal } from "lucide-react";
import { useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";

import type { PlanningGridColumn } from "./planningGanttModel";
import { taskColorClass } from "./planningGanttModel";
import { PlanningGanttGridCell } from "./PlanningGanttGridCell";
import { fitPlanningRowHeight } from "./planningRowHeights";
import type { PlanningTask } from "./types";

type RowResizeState = { pointerId: number; startY: number; startHeight: number } | null;

export function PlanningGanttGridRow({
  assignedByTask,
  chainClass,
  columns,
  gridTemplateColumns,
  isSelected,
  minWidth,
  pinnedOffsets,
  readOnly,
  rowHeight,
  rowRef,
  rowSize,
  showCritical,
  task,
  onKeyDown,
  onOpenTaskMenu,
  onSelect,
  onSummaryDoubleClick,
  onTaskInlineEdit,
  onRowHeightChange,
  onRowHeightReset,
}: {
  assignedByTask: Map<string, string>;
  chainClass: string;
  columns: PlanningGridColumn[];
  gridTemplateColumns: string;
  isSelected: boolean;
  minWidth: number;
  pinnedOffsets: Map<string, number>;
  readOnly: boolean;
  rowHeight: number;
  rowRef: (element: HTMLDivElement | null) => void;
  rowSize: number;
  showCritical: boolean;
  task: PlanningTask;
  onKeyDown: (task: PlanningTask, event: KeyboardEvent<HTMLDivElement>) => void;
  onOpenTaskMenu: (taskId: string, x: number, y: number, event: { preventDefault: () => void; stopPropagation: () => void }) => void;
  onSelect: (taskId: string) => void;
  onSummaryDoubleClick: () => void;
  onTaskInlineEdit: (taskId: string, payload: Record<string, unknown>) => void;
  onRowHeightChange: (taskId: string, height: number) => void;
  onRowHeightReset: (taskId: string) => void;
}) {
  const [rowResize, setRowResize] = useState<RowResizeState>(null);
  const rowClass = `planning-owned-grid-row ${isSelected ? "selected" : ""} ${task.task_type === "summary" ? "summary" : ""} ${taskColorClass(task)} ${showCritical && task.critical ? "critical" : ""} ${chainClass}`;

  return (
    <div
      ref={rowRef}
      className={rowClass}
      role="row"
      tabIndex={0}
      style={{ gridTemplateColumns, height: rowHeight, minHeight: rowHeight, minWidth } as CSSProperties}
      onClick={() => onSelect(task.id)}
      onContextMenu={(event) => onOpenTaskMenu(task.id, event.clientX, event.clientY, event)}
      onDoubleClick={() => {
        if (task.task_type === "summary") onSummaryDoubleClick();
      }}
      onKeyDown={(event) => onKeyDown(task, event)}
    >
      {columns.map((column) => (
        <PlanningGanttGridCell key={column.id} assignedByTask={assignedByTask} column={column} pinnedOffsets={pinnedOffsets} readOnly={readOnly} task={task} onTaskEdit={onTaskInlineEdit} />
      ))}
      <button
        type="button"
        className="planning-owned-row-menu-trigger"
        aria-label={`Task actions for ${task.title}`}
        disabled={readOnly}
        onClick={(event) => onOpenTaskMenu(task.id, event.currentTarget.getBoundingClientRect().left, event.currentTarget.getBoundingClientRect().bottom + 4, event)}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      <div
        className="planning-owned-row-height-handle"
        role="separator"
        tabIndex={0}
        aria-label={`Resize row ${task.title}`}
        aria-orientation="horizontal"
        aria-valuemin={34}
        aria-valuemax={96}
        aria-valuenow={rowHeight}
        title="Drag to resize row. Double-click to fit row height."
        onDoubleClick={fitRow}
        onKeyDown={handleResizeKey}
        onPointerDown={startResize}
        onPointerMove={updateResize}
        onPointerUp={finishResize}
        onPointerCancel={finishResize}
      />
    </div>
  );

  function startResize(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setRowResize({ pointerId: event.pointerId, startY: event.clientY, startHeight: rowHeight });
  }

  function updateResize(event: PointerEvent<HTMLDivElement>) {
    if (!rowResize || rowResize.pointerId !== event.pointerId) return;
    event.preventDefault();
    onRowHeightChange(task.id, rowResize.startHeight + event.clientY - rowResize.startY);
  }

  function finishResize(event: PointerEvent<HTMLDivElement>) {
    if (!rowResize || rowResize.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.releasePointerCapture(event.pointerId);
    setRowResize(null);
  }

  function fitRow(event: { preventDefault: () => void; stopPropagation: () => void; currentTarget?: HTMLDivElement }) {
    event.preventDefault();
    event.stopPropagation();
    const row = event.currentTarget?.closest(".planning-owned-grid-row");
    if (row instanceof HTMLElement) onRowHeightChange(task.id, fitPlanningRowHeight(row.scrollHeight, rowSize));
  }

  function handleResizeKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!["Enter", "Escape", "Home", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].includes(event.key)) return;
    event.stopPropagation();
    if (event.key === "Enter") fitRow(event);
    else if (event.key === "Escape" || event.key === "Home") {
      event.preventDefault();
      onRowHeightReset(task.id);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      onRowHeightChange(task.id, rowHeight - 4);
    } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      onRowHeightChange(task.id, rowHeight + 4);
    }
  }
}

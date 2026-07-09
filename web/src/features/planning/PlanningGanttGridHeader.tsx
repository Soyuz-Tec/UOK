import type { DragEvent } from "react";

import { ColumnResizeHandle, type ColumnWidthMap } from "../../shared/tables";
import { autoFitColumnWidth, type PlanningGridColumn } from "./planningGanttModel";
import type { PlanningTask } from "./types";

export function PlanningGanttGridHeader({
  assignedByTask,
  columns,
  gridTemplateColumns,
  onColumnMoveBefore,
  onColumnWidthChange,
  onHeaderDoubleClick,
  tasks,
  totalWidth,
  widths,
}: {
  assignedByTask: Map<string, string>;
  columns: PlanningGridColumn[];
  gridTemplateColumns: string;
  onColumnMoveBefore: (sourceId: string, targetId: string) => void;
  onColumnWidthChange: (columnId: string, width: number) => void;
  onHeaderDoubleClick: (column: PlanningGridColumn) => void;
  tasks: PlanningTask[];
  totalWidth: number;
  widths: ColumnWidthMap;
}) {
  return (
    <div className="planning-owned-grid-header" role="row" style={{ gridTemplateColumns, minWidth: totalWidth }}>
      {columns.map((column) => (
        <span
          key={column.id}
          role="columnheader"
          draggable={columns.length > 1}
          onDoubleClick={() => onHeaderDoubleClick(column)}
          onDragOver={(event) => event.preventDefault()}
          onDragStart={(event) => startColumnDrag(column.id, event)}
          onDrop={(event) => dropColumnBefore(column.id, event)}
        >
          <span className="planning-owned-grid-header-label">{column.label}</span>
          {column.resizable === false ? null : (
            <ColumnResizeHandle
              label={column.label}
              maxWidth={column.maxWidth}
              minWidth={column.minWidth}
              width={widths[column.id]}
              onResize={(value) => onColumnWidthChange(column.id, value)}
              onReset={() => onColumnWidthChange(column.id, autoFitColumnWidth(column, tasks, assignedByTask))}
            />
          )}
        </span>
      ))}
    </div>
  );

  function startColumnDrag(columnId: string, event: DragEvent<HTMLSpanElement>) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", columnId);
  }

  function dropColumnBefore(targetId: string, event: DragEvent<HTMLSpanElement>) {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("text/plain");
    if (sourceId) onColumnMoveBefore(sourceId, targetId);
  }
}

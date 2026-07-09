import { ArrowUpDown } from "lucide-react";
import type { DragEvent } from "react";

import { ColumnResizeHandle, type ColumnWidthMap } from "../../shared/tables";
import { autoFitColumnWidth, type PlanningGridColumn } from "./planningGanttModel";
import type { PlanningGridSort } from "./planningGridSortModel";
import type { PinnedColumnOffsetMap } from "./planningPinnedColumns";
import type { PlanningTask } from "./types";

export function PlanningGanttGridHeader({
  assignedByTask,
  columns,
  gridTemplateColumns,
  onColumnMoveBefore,
  onColumnWidthChange,
  onHeaderDoubleClick,
  onSort,
  pinnedOffsets,
  sort,
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
  onSort: (columnId: string) => void;
  pinnedOffsets: PinnedColumnOffsetMap;
  sort: PlanningGridSort;
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
          aria-sort={sort?.columnId === column.id ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
          className={pinnedOffsets.has(column.id) ? "planning-owned-pinned-column" : undefined}
          draggable={columns.length > 1}
          style={pinnedStyle(column.id)}
          onDoubleClick={() => onHeaderDoubleClick(column)}
          onDragOver={(event) => event.preventDefault()}
          onDragStart={(event) => startColumnDrag(column.id, event)}
          onDrop={(event) => dropColumnBefore(column.id, event)}
        >
          <span className="planning-owned-grid-header-label">{column.label}</span>
          <button type="button" className="planning-owned-sort-button" aria-label={`Sort by ${column.label}`} onClick={() => onSort(column.id)}>
            <ArrowUpDown size={13} aria-hidden="true" />
          </button>
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

  function pinnedStyle(columnId: string) {
    const left = pinnedOffsets.get(columnId);
    return left === undefined ? undefined : { left };
  }
}

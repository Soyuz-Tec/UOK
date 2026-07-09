import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { ColumnResizeHandle, useResizableColumns, type DataTableColumn } from "../../shared/tables";
import type { ColumnVisibilityMap } from "../../shared/tables";
import type { Appearance } from "../../shared/types";
import type { PlanningSchedule, PlanningTask } from "./types";
import {
  assignedResourceNames,
  autoFitColumnWidth,
  buildTimeline,
  finishDrag,
  gridColumns,
  gridValue,
  rowHeight,
  taskColorClass,
  visibleRows,
  xForDate,
  type DragState,
  type PlanningGridColumn,
  type TimelineScale,
} from "./planningGanttModel";
import { DependencyLines, TaskShape, TimelineBackground, TimelineHeaders, TodayMarker } from "./PlanningGanttShapes";
import type { FieldPreset, ViewDensity } from "./planningTimelineModel";

export function PlanningGantt({
  schedule,
  appearance,
  scale,
  showCritical,
  showBaselines,
  selectedTaskId,
  fieldPreset,
  columnVisibility,
  summaryExpanded,
  viewDensity,
  todaySignal,
  onTaskSelect,
  onTaskReschedule,
  onTaskProgress,
  onSummaryExpandedChange,
  onViewDensityChange,
}: {
  schedule: PlanningSchedule;
  appearance: Appearance;
  scale: TimelineScale;
  showCritical: boolean;
  showBaselines: boolean;
  selectedTaskId: string;
  fieldPreset: FieldPreset;
  columnVisibility: ColumnVisibilityMap;
  summaryExpanded: boolean;
  viewDensity: ViewDensity;
  todaySignal: number;
  onTaskSelect: (taskId: string) => void;
  onTaskReschedule: (taskId: string, start: string, end: string) => void;
  onTaskProgress: (taskId: string, progress: number) => void;
  onSummaryExpandedChange: (expanded: boolean) => void;
  onViewDensityChange: (density: ViewDensity) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const rowSize = rowHeight(viewDensity);
  const columns = useMemo(() => gridColumns(fieldPreset).filter((column) => columnVisibility[column.id] !== false), [columnVisibility, fieldPreset]);
  const resizeColumns = useMemo(() => columns.map(toResizableColumn), [columns]);
  const { setColumnWidth, totalWidth, widths } = useResizableColumns(resizeColumns, `planning.gantt.${fieldPreset}`);
  const chart = useMemo(() => buildTimeline(schedule, scale, viewDensity), [scale, schedule, viewDensity]);
  const visibleTasks = useMemo(() => visibleRows(schedule.tasks, summaryExpanded), [schedule.tasks, summaryExpanded]);
  const assignedByTask = useMemo(() => assignedResourceNames(schedule), [schedule]);
  const taskRows = useMemo(() => new Map(visibleTasks.map((task, index) => [task.id, index])), [visibleTasks]);
  const width = Math.max(chart.units.length * chart.cellWidth, 480);
  const headerHeight = 54;
  const height = headerHeight + visibleTasks.length * rowSize;
  const gridTemplateColumns = columns.map((column) => `${widths[column.id]}px`).join(" ");

  useEffect(() => {
    if (!todaySignal || !scrollRef.current) return;
    const todayX = xForDate(new Date(), chart.start, scale, chart.cellWidth);
    scrollRef.current.scrollTo({ left: Math.max(0, todayX - scrollRef.current.clientWidth / 2), behavior: "smooth" });
  }, [chart.cellWidth, chart.start, scale, todaySignal]);

  return (
    <div
      className={`planning-gantt-shell planning-owned-gantt planning-owned-${appearance}`}
      aria-label="Planning Gantt chart"
      style={{ "--planning-grid-width": `${Math.max(totalWidth, 340)}px` } as CSSProperties}
    >
      <div className="planning-owned-grid" role="table" aria-label="Planning task grid">
        <div className="planning-owned-grid-header" role="row" style={{ gridTemplateColumns, minWidth: totalWidth }}>
          {columns.map((column) => (
            <span key={column.id} role="columnheader" onDoubleClick={() => handleHeaderDoubleClick(column)}>
              <span className="planning-owned-grid-header-label">{column.label}</span>
              {column.resizable === false ? null : (
                <ColumnResizeHandle
                  label={column.label}
                  maxWidth={column.maxWidth}
                  minWidth={column.minWidth}
                  width={widths[column.id]}
                  onResize={(value) => setColumnWidth(column.id, value)}
                  onReset={() => setColumnWidth(column.id, autoFitColumnWidth(column, visibleTasks, assignedByTask))}
                />
              )}
            </span>
          ))}
        </div>
        <div className="planning-owned-grid-body">
          {visibleTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              className={`planning-owned-grid-row ${task.id === selectedTaskId ? "selected" : ""} ${task.task_type === "summary" ? "summary" : ""} ${taskColorClass(task)} ${showCritical && task.critical ? "critical" : ""}`}
              role="row"
              style={{ gridTemplateColumns, minHeight: rowSize, minWidth: totalWidth }}
              onClick={() => onTaskSelect(task.id)}
              onDoubleClick={() => {
                if (task.task_type === "summary") onSummaryExpandedChange(!summaryExpanded);
              }}
            >
              {columns.map((column) => (
                <span key={column.id} role="cell">{gridValue(column.id, task, assignedByTask)}</span>
              ))}
            </button>
          ))}
        </div>
      </div>
      <div
        className="planning-owned-chart"
        ref={scrollRef}
        aria-label="Planning timeline"
        onPointerUp={(event) => {
          if (!drag) return;
          finishDrag(event.clientX, drag, chart.cellWidth, scale, visibleTasks, onTaskReschedule, onTaskProgress);
          setDrag(null);
        }}
        onPointerCancel={() => setDrag(null)}
      >
        <svg width={width} height={height} role="img" aria-label={`${schedule.project.name} timeline`}>
          <TimelineHeaders units={chart.units} cellWidth={chart.cellWidth} headerHeight={headerHeight} width={width} />
          <TimelineBackground units={chart.units} cellWidth={chart.cellWidth} headerHeight={headerHeight} height={height} rowSize={rowSize} rows={visibleTasks.length} />
          <DependencyLines schedule={schedule} tasks={visibleTasks} taskRows={taskRows} chartStart={chart.start} scale={scale} cellWidth={chart.cellWidth} rowSize={rowSize} headerHeight={headerHeight} />
          {visibleTasks.map((task, index) => (
            <TaskShape
              key={task.id}
              task={task}
              index={index}
              chartStart={chart.start}
              scale={scale}
              cellWidth={chart.cellWidth}
              rowSize={rowSize}
              headerHeight={headerHeight}
              selected={task.id === selectedTaskId}
              showCritical={showCritical}
              showBaselines={showBaselines}
              onSelect={onTaskSelect}
              onDragStart={(taskId, mode, clientX, barWidth) => setDrag({ taskId, mode, startX: clientX, barWidth })}
            />
          ))}
          <TodayMarker chartStart={chart.start} scale={scale} cellWidth={chart.cellWidth} height={height} />
        </svg>
      </div>
    </div>
  );

  function handleHeaderDoubleClick(column: PlanningGridColumn) {
    if (column.id === "task") {
      onViewDensityChange(viewDensity === "compact" ? "standard" : "compact");
      return;
    }
    setColumnWidth(column.id, autoFitColumnWidth(column, visibleTasks, assignedByTask));
  }
}

function toResizableColumn(column: PlanningGridColumn): DataTableColumn<PlanningTask> {
  return {
    id: column.id,
    header: column.label,
    defaultWidth: column.defaultWidth,
    minWidth: column.minWidth,
    maxWidth: column.maxWidth,
    resizable: column.resizable,
    renderCell: () => null,
  };
}

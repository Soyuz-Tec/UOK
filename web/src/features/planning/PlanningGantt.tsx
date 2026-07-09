import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { ColumnResizeHandle, useResizableColumns, type DataTableColumn } from "../../shared/tables";
import type { ColumnVisibilityMap } from "../../shared/tables";
import type { Appearance } from "../../shared/types";
import type { PlanningSchedule, PlanningTask } from "./types";
import {
  assignedResourceNames,
  autoFitColumnWidth,
  buildTimeline,
  dateValue,
  durationBetween,
  durationUnits,
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
  type TimelineUnit,
} from "./planningGanttModel";
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
  onTaskProgress: _onTaskProgress,
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
          finishDrag(event.clientX, drag, chart.cellWidth, scale, visibleTasks, onTaskReschedule);
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
              onDragStart={(clientX) => setDrag({ taskId: task.id, startX: clientX })}
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

function TimelineHeaders({ units, cellWidth, headerHeight, width }: { units: TimelineUnit[]; cellWidth: number; headerHeight: number; width: number }) {
  const groups: { label: string; x: number; width: number }[] = [];
  for (const unit of units) {
    const last = groups[groups.length - 1];
    if (last?.label === unit.group) last.width += cellWidth;
    else groups.push({ label: unit.group, x: groups.reduce((sum, group) => sum + group.width, 0), width: cellWidth });
  }
  return (
    <g className="planning-owned-header">
      <rect x="0" y="0" width={width} height={headerHeight} />
      {groups.map((group) => <text key={`${group.label}-${group.x}`} x={group.x + group.width / 2} y="18" textAnchor="middle">{group.label}</text>)}
      {units.map((unit, index) => <text key={unit.key} x={index * cellWidth + cellWidth / 2} y="42" textAnchor="middle">{unit.label}</text>)}
    </g>
  );
}

function TimelineBackground({ units, cellWidth, headerHeight, height, rowSize, rows }: { units: TimelineUnit[]; cellWidth: number; headerHeight: number; height: number; rowSize: number; rows: number }) {
  return (
    <g className="planning-owned-background">
      {units.map((unit, index) => (
        <rect key={unit.key} className={unit.holiday ? "holiday" : unit.weekend ? "weekend" : ""} x={index * cellWidth} y={headerHeight} width={cellWidth} height={height - headerHeight} />
      ))}
      {units.map((unit, index) => <line key={`v-${unit.key}`} x1={index * cellWidth} y1="0" x2={index * cellWidth} y2={height} />)}
      {Array.from({ length: rows + 1 }, (_, index) => <line key={`h-${index}`} x1="0" y1={headerHeight + index * rowSize} x2={units.length * cellWidth} y2={headerHeight + index * rowSize} />)}
    </g>
  );
}

function DependencyLines({ schedule, tasks, taskRows, chartStart, scale, cellWidth, rowSize, headerHeight }: { schedule: PlanningSchedule; tasks: PlanningTask[]; taskRows: Map<string, number>; chartStart: Date; scale: TimelineScale; cellWidth: number; rowSize: number; headerHeight: number }) {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  return (
    <g className="planning-owned-dependencies">
      {schedule.dependencies.map((dependency) => {
        const source = taskMap.get(dependency.predecessor_task_id);
        const target = taskMap.get(dependency.successor_task_id);
        const sourceRow = taskRows.get(dependency.predecessor_task_id);
        const targetRow = taskRows.get(dependency.successor_task_id);
        if (!source || !target || sourceRow === undefined || targetRow === undefined) return null;
        const x1 = xForDate(dateValue(source.end), chartStart, scale, cellWidth) + cellWidth * 0.75;
        const y1 = headerHeight + sourceRow * rowSize + rowSize / 2;
        const x2 = xForDate(dateValue(target.start), chartStart, scale, cellWidth);
        const y2 = headerHeight + targetRow * rowSize + rowSize / 2;
        const mid = Math.max(x1 + 16, x2 - 16);
        return <path key={dependency.id} d={`M ${x1} ${y1} L ${mid} ${y1} L ${mid} ${y2} L ${x2} ${y2}`} />;
      })}
    </g>
  );
}

function TaskShape({ task, index, chartStart, scale, cellWidth, rowSize, headerHeight, selected, showCritical, showBaselines, onSelect, onDragStart }: { task: PlanningTask; index: number; chartStart: Date; scale: TimelineScale; cellWidth: number; rowSize: number; headerHeight: number; selected: boolean; showCritical: boolean; showBaselines: boolean; onSelect: (taskId: string) => void; onDragStart: (clientX: number) => void }) {
  const x = xForDate(dateValue(task.start), chartStart, scale, cellWidth);
  const y = headerHeight + index * rowSize + Math.max(7, rowSize * 0.22);
  const barHeight = Math.max(18, rowSize * 0.46);
  const width = task.task_type === "milestone" ? barHeight : Math.max(cellWidth * durationUnits(task, scale), cellWidth * 0.65);
  const critical = showCritical && task.critical;
  const className = `planning-owned-task ${task.task_type} ${taskColorClass(task)} ${critical ? "critical" : ""} ${selected ? "selected" : ""}`;
  if (task.task_type === "milestone") {
    const centerX = x + barHeight / 2;
    const centerY = y + barHeight / 2;
    return (
      <g className={className} tabIndex={0} onClick={() => onSelect(task.id)} onPointerDown={(event) => onDragStart(event.clientX)}>
        <polygon points={`${centerX},${y} ${x + barHeight},${centerY} ${centerX},${y + barHeight} ${x},${centerY}`} />
        <text x={x + barHeight + 6} y={centerY + 4}>{task.title}</text>
      </g>
    );
  }
  return (
    <g className={className} tabIndex={0} onClick={() => onSelect(task.id)} onPointerDown={(event) => onDragStart(event.clientX)}>
      {showBaselines && task.baseline_start && task.baseline_end ? <BaselineShape task={task} chartStart={chartStart} scale={scale} cellWidth={cellWidth} y={y + barHeight + 6} /> : null}
      <rect x={x} y={y} width={width} height={barHeight} rx={task.task_type === "summary" ? 1 : 4} />
      <rect className="progress" x={x} y={y} width={width * Math.max(0, Math.min(100, task.progress)) / 100} height={barHeight} rx={task.task_type === "summary" ? 1 : 4} />
      <text x={x + 8} y={y + barHeight / 2 + 4}>{task.title}</text>
    </g>
  );
}

function BaselineShape({ task, chartStart, scale, cellWidth, y }: { task: PlanningTask; chartStart: Date; scale: TimelineScale; cellWidth: number; y: number }) {
  if (!task.baseline_start || !task.baseline_end) return null;
  const x = xForDate(dateValue(task.baseline_start), chartStart, scale, cellWidth);
  const width = Math.max(cellWidth * durationBetween(task.baseline_start, task.baseline_end, scale), cellWidth * 0.5);
  return <rect className="baseline" x={x} y={y} width={width} height="4" rx="2" />;
}

function TodayMarker({ chartStart, scale, cellWidth, height }: { chartStart: Date; scale: TimelineScale; cellWidth: number; height: number }) {
  const x = xForDate(new Date(), chartStart, scale, cellWidth);
  if (x < 0) return null;
  return <line className="planning-owned-today" x1={x} y1="0" x2={x} y2={height} />;
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

import type { KeyboardEvent, PointerEvent } from "react";

import type { PlanningProject, PlanningSchedule, PlanningTask } from "./types";
import type { PlanningDependencyChain } from "./planningDependencyChain";
import type { TimelineCreateDraft } from "./planningTimelineCreateModel";
import {
  dateValue,
  durationBetween,
  durationUnits,
  taskColorClass,
  taskStatusIndicator,
  xForDate,
  type TimelineScale,
  type TimelineUnit,
} from "./planningGanttModel";

export function TimelineHeaders({ units, cellWidth, headerHeight, width }: { units: TimelineUnit[]; cellWidth: number; headerHeight: number; width: number }) {
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

export function TimelineBackground({ units, cellWidth, headerHeight, height, rowSize, rows }: { units: TimelineUnit[]; cellWidth: number; headerHeight: number; height: number; rowSize: number; rows: number }) {
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

export function DependencyLines({ schedule, tasks, taskRows, chartStart, scale, cellWidth, rowSize, headerHeight, dependencyChain }: { schedule: PlanningSchedule; tasks: PlanningTask[]; taskRows: Map<string, number>; chartStart: Date; scale: TimelineScale; cellWidth: number; rowSize: number; headerHeight: number; dependencyChain: PlanningDependencyChain }) {
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
        return <path key={dependency.id} className={dependencyChain.dependencyIds.has(dependency.id) ? "chain-highlight" : undefined} d={`M ${x1} ${y1} L ${mid} ${y1} L ${mid} ${y2} L ${x2} ${y2}`} />;
      })}
    </g>
  );
}

export function TaskShape({
  task,
  index,
  chartStart,
  scale,
  cellWidth,
  rowSize,
  headerHeight,
  selected,
  chainClass,
  showCritical,
  showBaselines,
  onSelect,
  onDragStart,
  onLinkStart,
  onLinkFinish,
}: {
  task: PlanningTask;
  index: number;
  chartStart: Date;
  scale: TimelineScale;
  cellWidth: number;
  rowSize: number;
  headerHeight: number;
  selected: boolean;
  chainClass: string;
  showCritical: boolean;
  showBaselines: boolean;
  onSelect: (taskId: string) => void;
  onDragStart: (taskId: string, mode: "move" | "resize-start" | "resize-end" | "progress", clientX: number, barWidth?: number) => void;
  onLinkStart: (taskId: string, x: number, y: number, event: PointerEvent<SVGCircleElement> | KeyboardEvent<SVGCircleElement>) => void;
  onLinkFinish: (taskId: string, x: number, y: number, event: PointerEvent<SVGCircleElement> | KeyboardEvent<SVGCircleElement>) => void;
}) {
  const x = xForDate(dateValue(task.start), chartStart, scale, cellWidth);
  const y = headerHeight + index * rowSize + Math.max(7, rowSize * 0.22);
  const barHeight = Math.max(18, rowSize * 0.46);
  const width = task.task_type === "milestone" ? barHeight : Math.max(cellWidth * durationUnits(task, scale), cellWidth * 0.65);
  const critical = showCritical && task.critical;
  const className = `planning-owned-task ${task.task_type} ${taskColorClass(task)} ${critical ? "critical" : ""} ${selected ? "selected" : ""} ${chainClass}`;
  const indicator = taskStatusIndicator(task, showCritical);
  const accessibilityLabel = `${task.title}, ${indicator.label}, ${task.progress}% complete`;
  if (task.task_type === "milestone") {
    const centerX = x + barHeight / 2;
    const centerY = y + barHeight / 2;
    return (
      <g
        className={className}
        role="button"
        tabIndex={0}
        aria-label={accessibilityLabel}
        onClick={() => onSelect(task.id)}
        onKeyDown={(event) => selectOnKey(event, task.id, onSelect)}
        onPointerDown={(event) => onDragStart(task.id, "move", event.clientX)}
      >
        <title>{accessibilityLabel}</title>
        <polygon points={`${centerX},${y} ${x + barHeight},${centerY} ${centerX},${y + barHeight} ${x},${centerY}`} />
        <TaskStatusCode x={x + barHeight + 6} y={y + 1} indicator={indicator} />
        <text x={x + barHeight + statusCodeWidth(indicator.code) + 14} y={centerY + 4}>{task.title}</text>
        <DependencyHandles task={task} sourceX={x + barHeight + 12} targetX={x - 12} y={centerY} onLinkStart={onLinkStart} onLinkFinish={onLinkFinish} />
        <TaskTooltip task={task} x={x} y={Math.max(4, y - 50)} indicator={indicator} />
      </g>
    );
  }
  const progressWidth = width * Math.max(0, Math.min(100, task.progress)) / 100;
  const indicatorWidth = statusCodeWidth(indicator.code);
  const indicatorX = width > indicatorWidth + 72 ? x + width - indicatorWidth - 5 : x + width + 6;
  return (
    <g
      className={className}
      role="button"
      tabIndex={0}
      aria-label={accessibilityLabel}
      onClick={() => onSelect(task.id)}
      onKeyDown={(event) => selectOnKey(event, task.id, onSelect)}
    >
      <title>{accessibilityLabel}</title>
      {showBaselines && task.baseline_start && task.baseline_end ? <BaselineShape task={task} chartStart={chartStart} scale={scale} cellWidth={cellWidth} y={y + barHeight + 6} /> : null}
      <rect x={x} y={y} width={width} height={barHeight} rx={task.task_type === "summary" ? 1 : 4} onPointerDown={(event) => onDragStart(task.id, "move", event.clientX)} />
      <rect className="progress" x={x} y={y} width={progressWidth} height={barHeight} rx={task.task_type === "summary" ? 1 : 4} />
      <rect className="planning-owned-resize-handle start" x={x - 4} y={y} width="8" height={barHeight} rx="3" onPointerDown={(event) => onDragStart(task.id, "resize-start", event.clientX)} />
      <rect className="planning-owned-resize-handle end" x={x + width - 4} y={y} width="8" height={barHeight} rx="3" onPointerDown={(event) => onDragStart(task.id, "resize-end", event.clientX)} />
      <circle className="planning-owned-progress-handle" cx={x + progressWidth} cy={y + barHeight / 2} r="5" onPointerDown={(event) => onDragStart(task.id, "progress", event.clientX, width)} />
      <text x={x + 8} y={y + barHeight / 2 + 4}>{task.title}</text>
      <TaskStatusCode x={indicatorX} y={y + Math.max(2, (barHeight - 18) / 2)} indicator={indicator} />
      <DependencyHandles task={task} sourceX={x + width + 12} targetX={x - 12} y={y + barHeight / 2} onLinkStart={onLinkStart} onLinkFinish={onLinkFinish} />
      <TaskTooltip task={task} x={x} y={Math.max(4, y - 50)} indicator={indicator} />
    </g>
  );
}

function DependencyHandles({ task, sourceX, targetX, y, onLinkStart, onLinkFinish }: {
  task: PlanningTask;
  sourceX: number;
  targetX: number;
  y: number;
  onLinkStart: (taskId: string, x: number, y: number, event: PointerEvent<SVGCircleElement> | KeyboardEvent<SVGCircleElement>) => void;
  onLinkFinish: (taskId: string, x: number, y: number, event: PointerEvent<SVGCircleElement> | KeyboardEvent<SVGCircleElement>) => void;
}) {
  return (
    <g className="planning-owned-link-handles">
      <circle className="planning-owned-link-handle target" cx={targetX} cy={y} r="5" tabIndex={0} role="button" aria-label={`Finish dependency at ${task.title}`} onPointerUp={(event) => onLinkFinish(task.id, targetX, y, event)} onKeyDown={(event) => linkOnKey(event, () => onLinkFinish(task.id, targetX, y, event))} />
      <circle className="planning-owned-link-handle source" cx={sourceX} cy={y} r="5" tabIndex={0} role="button" aria-label={`Start dependency from ${task.title}`} onPointerDown={(event) => onLinkStart(task.id, sourceX, y, event)} onKeyDown={(event) => linkOnKey(event, () => onLinkStart(task.id, sourceX, y, event))} />
    </g>
  );
}

function TaskStatusCode({ x, y, indicator }: { x: number; y: number; indicator: { code: string; label: string } }) {
  const width = statusCodeWidth(indicator.code);
  return (
    <g className="planning-owned-status-code" aria-label={indicator.label}>
      <rect x={x} y={y} width={width} height="18" rx="4" />
      <text x={x + width / 2} y={y + 13} textAnchor="middle">{indicator.code}</text>
    </g>
  );
}

function statusCodeWidth(code: string) {
  return Math.max(34, code.length * 7 + 12);
}

function TaskTooltip({ task, x, y, indicator }: { task: PlanningTask; x: number; y: number; indicator: { code: string; label: string } }) {
  return (
    <g className="planning-owned-tooltip" aria-hidden="true">
      <rect x={x} y={y} width="224" height="42" rx="6" />
      <text x={x + 10} y={y + 16}>{task.wbs ? `${task.wbs} ` : ""}{task.title}</text>
      <text className="muted" x={x + 10} y={y + 32}>{indicator.label} · {task.start} to {task.end} · {task.progress}%</text>
    </g>
  );
}

function selectOnKey(event: KeyboardEvent<SVGGElement>, taskId: string, onSelect: (taskId: string) => void) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  onSelect(taskId);
}

function linkOnKey(event: KeyboardEvent<SVGCircleElement>, action: () => void) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  event.stopPropagation();
  action();
}

function BaselineShape({ task, chartStart, scale, cellWidth, y }: { task: PlanningTask; chartStart: Date; scale: TimelineScale; cellWidth: number; y: number }) {
  if (!task.baseline_start || !task.baseline_end) return null;
  const x = xForDate(dateValue(task.baseline_start), chartStart, scale, cellWidth);
  const width = Math.max(cellWidth * durationBetween(task.baseline_start, task.baseline_end, scale), cellWidth * 0.5);
  return <rect className="baseline" x={x} y={y} width={width} height="4" rx="2" />;
}

export function TodayMarker({ chartStart, scale, cellWidth, height }: { chartStart: Date; scale: TimelineScale; cellWidth: number; height: number }) {
  const x = xForDate(new Date(), chartStart, scale, cellWidth);
  if (x < 0) return null;
  return <line className="planning-owned-today" x1={x} y1="0" x2={x} y2={height} />;
}

export function ProjectBoundaryMarkers({ project, chartStart, scale, cellWidth, height }: { project: PlanningProject; chartStart: Date; scale: TimelineScale; cellWidth: number; height: number }) {
  const markers = [
    { key: "start", label: "Project start", x: xForDate(dateValue(project.start), chartStart, scale, cellWidth) },
    { key: "end", label: "Project end", x: xForDate(dateValue(project.end), chartStart, scale, cellWidth) + cellWidth },
  ];
  return (
    <g className="planning-owned-boundary-markers">
      {markers.map((marker) => (
        <g key={marker.key} className={`planning-owned-boundary-marker ${marker.key}`}>
          <line x1={marker.x} y1="0" x2={marker.x} y2={height} />
          <text x={marker.x + 6} y="52">{marker.label}</text>
        </g>
      ))}
    </g>
  );
}

export function TimelineCreateDraftShape({ draft, headerHeight, height }: { draft: TimelineCreateDraft; headerHeight: number; height: number }) {
  return (
    <g className="planning-owned-create-draft" aria-hidden="true">
      <rect x={draft.x} y={headerHeight + 6} width={draft.width} height={Math.max(28, height - headerHeight - 12)} rx="4" />
      <text x={draft.x + 8} y={headerHeight + 26}>{draft.start} to {draft.end}</text>
    </g>
  );
}

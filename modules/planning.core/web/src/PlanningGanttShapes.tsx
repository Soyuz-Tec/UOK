import type { KeyboardEvent, PointerEvent } from "react";

import { useUokLocalization } from "@uok/shared/localization";
import type { PlanningProject, PlanningSchedule, PlanningTask } from "./types";
import type { PlanningDependencyChain } from "./planningDependencyChain";
import type { TimelineCreateDraft } from "./planningTimelineCreateModel";
import type { PlanningTimelineMarker } from "./planningTimelineMarkers";
import type { PlanningRowLayout } from "./planningRowHeights";
import { PlanningBaselineLane } from "./PlanningBaselineLane";
import { projectBoundaryMarkers } from "./planningBoundaryMarkers";
import {
  dateValue,
  durationUnits,
  taskColorClass,
  taskStatusIndicator,
  xForDate,
  type TimelineScale,
  type TimelineUnit,
} from "./planningGanttModel";

export { projectBoundaryMarkers } from "./planningBoundaryMarkers";

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

export function TimelineBackground({ units, cellWidth, headerHeight, height, rowLayouts }: { units: TimelineUnit[]; cellWidth: number; headerHeight: number; height: number; rowLayouts: PlanningRowLayout[] }) {
  return (
    <g className="planning-owned-background">
      {units.map((unit, index) => (
        <rect key={unit.key} className={unit.holiday ? "holiday" : unit.weekend ? "weekend" : ""} x={index * cellWidth} y={headerHeight} width={cellWidth} height={height - headerHeight} />
      ))}
      {units.map((unit, index) => <line key={`v-${unit.key}`} x1={index * cellWidth} y1="0" x2={index * cellWidth} y2={height} />)}
      <line x1="0" y1={headerHeight} x2={units.length * cellWidth} y2={headerHeight} />
      {rowLayouts.map((layout) => <line key={`h-${layout.taskId}`} x1="0" y1={headerHeight + layout.top + layout.height} x2={units.length * cellWidth} y2={headerHeight + layout.top + layout.height} />)}
    </g>
  );
}

export function DependencyLines({ schedule, tasks, rowLayoutByTask, chartStart, scale, cellWidth, headerHeight, dependencyChain }: { schedule: PlanningSchedule; tasks: PlanningTask[]; rowLayoutByTask: Map<string, PlanningRowLayout>; chartStart: Date; scale: TimelineScale; cellWidth: number; headerHeight: number; dependencyChain: PlanningDependencyChain }) {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  return (
    <g className="planning-owned-dependencies">
      {schedule.dependencies.map((dependency) => {
        const source = taskMap.get(dependency.predecessor_task_id);
        const target = taskMap.get(dependency.successor_task_id);
        const sourceRow = rowLayoutByTask.get(dependency.predecessor_task_id);
        const targetRow = rowLayoutByTask.get(dependency.successor_task_id);
        if (!source || !target || !sourceRow || !targetRow) return null;
        const x1 = xForDate(dateValue(source.end), chartStart, scale, cellWidth) + cellWidth * 0.75;
        const y1 = headerHeight + sourceRow.top + sourceRow.height / 2;
        const x2 = xForDate(dateValue(target.start), chartStart, scale, cellWidth);
        const y2 = headerHeight + targetRow.top + targetRow.height / 2;
        const mid = Math.max(x1 + 16, x2 - 16);
        return <path key={dependency.id} className={dependencyChain.dependencyIds.has(dependency.id) ? "chain-highlight" : undefined} d={`M ${x1} ${y1} L ${mid} ${y1} L ${mid} ${y2} L ${x2} ${y2}`} />;
      })}
    </g>
  );
}

export function TaskShape({
  task,
  rowTop,
  chartStart,
  scale,
  cellWidth,
  rowSize,
  headerHeight,
  selected,
  chainClass,
  showCritical,
  showBaselines,
  readOnly,
  onSelect,
  onDragStart,
  onLinkStart,
  onLinkFinish,
}: {
  task: PlanningTask;
  rowTop: number;
  chartStart: Date;
  scale: TimelineScale;
  cellWidth: number;
  rowSize: number;
  headerHeight: number;
  selected: boolean;
  chainClass: string;
  showCritical: boolean;
  showBaselines: boolean;
  readOnly: boolean;
  onSelect: (taskId: string) => void;
  onDragStart: (taskId: string, mode: "move" | "resize-start" | "resize-end" | "progress", clientX: number, barWidth?: number) => void;
  onLinkStart: (taskId: string, x: number, y: number, event: PointerEvent<SVGCircleElement> | KeyboardEvent<SVGCircleElement>) => void;
  onLinkFinish: (taskId: string, x: number, y: number, event: PointerEvent<SVGCircleElement> | KeyboardEvent<SVGCircleElement>) => void;
}) {
  const x = xForDate(dateValue(task.start), chartStart, scale, cellWidth);
  const y = headerHeight + rowTop + Math.max(7, rowSize * 0.22);
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
        onPointerDown={readOnly ? undefined : (event) => onDragStart(task.id, "move", event.clientX)}
      >
        <title>{accessibilityLabel}</title>
        <polygon points={`${centerX},${y} ${x + barHeight},${centerY} ${centerX},${y + barHeight} ${x},${centerY}`} />
        <TaskStatusCode x={x + barHeight + 6} y={y + 1} indicator={indicator} />
        <text x={x + barHeight + statusCodeWidth(indicator.code) + 14} y={centerY + 4}>{task.title}</text>
        {readOnly ? null : <DependencyHandles task={task} sourceX={x + barHeight + 12} targetX={x - 12} y={centerY} onLinkStart={onLinkStart} onLinkFinish={onLinkFinish} />}
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
      <rect x={x} y={y} width={width} height={barHeight} rx={task.task_type === "summary" ? 1 : 4} onPointerDown={readOnly ? undefined : (event) => onDragStart(task.id, "move", event.clientX)} />
      <rect className="progress" x={x} y={y} width={progressWidth} height={barHeight} rx={task.task_type === "summary" ? 1 : 4} />
      {readOnly ? null : <rect className="planning-owned-resize-handle start" x={x - 4} y={y} width="8" height={barHeight} rx="3" onPointerDown={(event) => onDragStart(task.id, "resize-start", event.clientX)} />}
      {readOnly ? null : <rect className="planning-owned-resize-handle end" x={x + width - 4} y={y} width="8" height={barHeight} rx="3" onPointerDown={(event) => onDragStart(task.id, "resize-end", event.clientX)} />}
      {readOnly ? null : <circle className="planning-owned-progress-handle" cx={x + progressWidth} cy={y + barHeight / 2} r="5" onPointerDown={(event) => onDragStart(task.id, "progress", event.clientX, width)} />}
      <text x={x + 8} y={y + barHeight / 2 + 4}>{task.title}</text>
      <TaskStatusCode x={indicatorX} y={y + Math.max(2, (barHeight - 18) / 2)} indicator={indicator} />
      {showBaselines ? <PlanningBaselineLane task={task} chartStart={chartStart} scale={scale} cellWidth={cellWidth} y={y + barHeight + 6} /> : null}
      {readOnly ? null : <DependencyHandles task={task} sourceX={x + width + 12} targetX={x - 12} y={y + barHeight / 2} onLinkStart={onLinkStart} onLinkFinish={onLinkFinish} />}
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

export function TodayMarker({ chartStart, scale, cellWidth, height }: { chartStart: Date; scale: TimelineScale; cellWidth: number; height: number }) {
  const x = xForDate(new Date(), chartStart, scale, cellWidth);
  if (x < 0) return null;
  return <line className="planning-owned-today" x1={x} y1="0" x2={x} y2={height} />;
}

export function ProjectBoundaryMarkers({ project, chartStart, scale, cellWidth, height }: { project: PlanningProject; chartStart: Date; scale: TimelineScale; cellWidth: number; height: number }) {
  const { t } = useUokLocalization();
  const markers = projectBoundaryMarkers(project, chartStart, scale, cellWidth, {
    start: t("planning.gantt.projectStart", "Project start"),
    end: t("planning.gantt.compatibilityHorizon", "Compatibility horizon"),
    target: t("planning.gantt.targetFinish", "Target finish"),
    calculated: t("planning.gantt.calculatedFinish", "Calculated finish"),
  });
  return (
    <g className="planning-owned-boundary-markers">
      {markers.map((marker) => (
        <g key={marker.keys.join("-")} className={`planning-owned-boundary-marker ${marker.keys.join(" ")}`} role="img" aria-label={marker.accessibilityLabel}>
          <title>{marker.accessibilityLabel}</title>
          <line x1={marker.x} y1="0" x2={marker.x} y2={height} />
          <text x={marker.x + 6} y="52">{marker.labels.join(" / ")}</text>
        </g>
      ))}
    </g>
  );
}

export function TaskTimelineMarkers({ markers, chartStart, scale, cellWidth, height }: { markers: PlanningTimelineMarker[]; chartStart: Date; scale: TimelineScale; cellWidth: number; height: number }) {
  if (markers.length === 0) return null;
  return (
    <g className="planning-owned-task-markers" aria-label="Task deadline markers">
      {markers.map((marker) => {
        const x = xForDate(dateValue(marker.date), chartStart, scale, cellWidth) + cellWidth;
        return (
          <g key={marker.id} className={`planning-owned-task-marker ${marker.kind}`} aria-label={marker.label}>
            <title>{marker.label} on {marker.date}</title>
            <line x1={x} y1="0" x2={x} y2={height} />
            <rect x={x + 5} y="4" width="34" height="18" rx="4" />
            <text x={x + 22} y="17" textAnchor="middle">{marker.code}</text>
          </g>
        );
      })}
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

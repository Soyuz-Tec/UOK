import { useId, type KeyboardEvent, type PointerEvent } from "react";

import type { PlanningTask } from "./types";
import type { TimelineCreateDraft } from "./planningTimelineCreateModel";
import type { PlanningRowLayout } from "./planningRowHeights";
import { PlanningBaselineLane } from "./PlanningBaselineLane";
import { planningBaselineLane } from "./planningBaselineLaneModel";
import {
  statusCodeWidth,
  TaskLabelViewport,
  taskOverlayGeometry,
  TaskStatusCode,
  TaskTooltip,
} from "./PlanningGanttTaskOverlays";
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
export { DependencyLines } from "./PlanningDependencyLines";
export { ProjectBoundaryMarkers, TaskTimelineMarkers } from "./PlanningPinnedTimelineMarkers";

export function TimelineHeaders({ units, cellWidth, headerHeight, width, offsetY = 0 }: { units: TimelineUnit[]; cellWidth: number; headerHeight: number; width: number; offsetY?: number }) {
  const groups: { label: string; x: number; width: number }[] = [];
  for (const unit of units) {
    const last = groups[groups.length - 1];
    if (last?.label === unit.group) last.width += cellWidth;
    else groups.push({ label: unit.group, x: groups.reduce((sum, group) => sum + group.width, 0), width: cellWidth });
  }
  return (
    <g className="planning-owned-header" transform={offsetY ? `translate(0 ${offsetY})` : undefined}>
      <rect x="0" y="0" width={width} height={headerHeight} />
      {groups.map((group) => <text key={`${group.label}-${group.x}`} x={group.x + group.width / 2} y="18" textAnchor="middle">{group.label}</text>)}
      {units.map((unit, index) => <text key={unit.key} x={index * cellWidth + cellWidth / 2} y="42" textAnchor="middle">{unit.label}</text>)}
    </g>
  );
}

export function TimelineBackground({ units, cellWidth, headerHeight, height, rowLayouts, width }: { units: TimelineUnit[]; cellWidth: number; headerHeight: number; height: number; rowLayouts: PlanningRowLayout[]; width: number }) {
  return (
    <g className="planning-owned-background">
      {units.map((unit, index) => (
        <rect key={unit.key} className={unit.holiday ? "holiday" : unit.weekend ? "weekend" : ""} x={index * cellWidth} y={headerHeight} width={cellWidth} height={height - headerHeight} />
      ))}
      {units.map((unit, index) => <line key={`v-${unit.key}`} x1={index * cellWidth} y1="0" x2={index * cellWidth} y2={height} />)}
      <line x1="0" y1={headerHeight} x2={width} y2={headerHeight} />
      {rowLayouts.map((layout) => <line key={`h-${layout.taskId}`} x1="0" y1={headerHeight + layout.top + layout.height} x2={width} y2={headerHeight + layout.top + layout.height} />)}
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
  timelineWidth,
  viewportLeft,
  viewportWidth,
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
  timelineWidth: number;
  viewportLeft: number;
  viewportWidth: number;
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
  const overlayId = useId().replace(/:/g, "");
  const x = xForDate(dateValue(task.start), chartStart, scale, cellWidth);
  const y = headerHeight + rowTop + Math.max(7, rowSize * 0.22);
  const barHeight = Math.max(18, rowSize * 0.46);
  const baselineY = Math.min(y + barHeight + 6, headerHeight + rowTop + rowSize - 8);
  const width = task.task_type === "milestone" ? barHeight : Math.max(cellWidth * durationUnits(task, scale), cellWidth * 0.65);
  const progressWidth = task.task_type === "milestone" ? 0 : width * Math.max(0, Math.min(100, task.progress)) / 100;
  const critical = showCritical && task.critical;
  const className = `planning-owned-task ${task.task_type} ${taskColorClass(task)} ${critical ? "critical" : ""} ${selected ? "selected" : ""} ${chainClass}`;
  const indicator = taskStatusIndicator(task, showCritical);
  const indicatorWidth = statusCodeWidth(indicator.code);
  const overlay = taskOverlayGeometry({
    barWidth: width,
    barX: x,
    hasHandles: !readOnly,
    headerHeight,
    indicatorWidth,
    progressHandleX: task.task_type === "milestone" || readOnly ? undefined : x + progressWidth,
    rowSize,
    rowTop,
    timelineWidth,
    viewportLeft,
    viewportWidth,
  });
  const baselineLabel = showBaselines ? planningBaselineLane(task, chartStart, scale, cellWidth)?.label : null;
  const accessibilityLabel = `${task.title}, ${indicator.label}, ${task.progress}% complete${baselineLabel ? `, ${baselineLabel}` : ""}`;
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
        <polygon className="planning-owned-task-bar" points={`${centerX},${y} ${x + barHeight},${centerY} ${centerX},${y + barHeight} ${x},${centerY}`} />
        <TaskStatusCode x={overlay.indicatorX} y={y + 1} indicator={indicator} />
        <TaskLabelViewport clipId={`${overlayId}-label`} x={readOnly ? overlay.indicatorRight + 8 : overlay.sourceHandleX + 10} y={y} width={Math.min(240, Math.max(0, timelineWidth - (readOnly ? overlay.indicatorRight + 12 : overlay.sourceHandleX + 14)))} height={barHeight} title={task.title} />
        {readOnly ? null : <DependencyHandles task={task} sourceX={overlay.sourceHandleX} targetX={Math.max(5, x - 12)} y={centerY} onLinkStart={onLinkStart} onLinkFinish={onLinkFinish} />}
        <TaskTooltip clipIdPrefix={`${overlayId}-tooltip`} task={task} x={overlay.tooltipX} y={overlay.tooltipY} indicator={indicator} />
      </g>
    );
  }
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
      <rect className="planning-owned-task-bar" x={x} y={y} width={width} height={barHeight} rx={task.task_type === "summary" ? 1 : 4} onPointerDown={readOnly ? undefined : (event) => onDragStart(task.id, "move", event.clientX)} />
      <rect className="progress" x={x} y={y} width={progressWidth} height={barHeight} rx={task.task_type === "summary" ? 1 : 4} />
      {readOnly ? null : <rect className="planning-owned-resize-handle start" x={x - 4} y={y} width="8" height={barHeight} rx="3" onPointerDown={(event) => onDragStart(task.id, "resize-start", event.clientX)} />}
      {readOnly ? null : <rect className="planning-owned-resize-handle end" x={x + width - 4} y={y} width="8" height={barHeight} rx="3" onPointerDown={(event) => onDragStart(task.id, "resize-end", event.clientX)} />}
      {readOnly ? null : <circle className="planning-owned-progress-handle" cx={x + progressWidth} cy={y + barHeight / 2} r="5" onPointerDown={(event) => onDragStart(task.id, "progress", event.clientX, width)} />}
      <TaskLabelViewport clipId={`${overlayId}-label`} x={overlay.labelX} y={y} width={overlay.labelWidth} height={barHeight} title={task.title} />
      <TaskStatusCode x={overlay.indicatorX} y={y + Math.max(2, (barHeight - 18) / 2)} indicator={indicator} />
      {showBaselines ? <PlanningBaselineLane task={task} chartStart={chartStart} scale={scale} cellWidth={cellWidth} y={baselineY} showCode={rowSize >= 50} timelineWidth={timelineWidth} /> : null}
      {readOnly ? null : <DependencyHandles task={task} sourceX={overlay.sourceHandleX} targetX={Math.max(5, x - 12)} y={y + barHeight / 2} onLinkStart={onLinkStart} onLinkFinish={onLinkFinish} />}
      <TaskTooltip clipIdPrefix={`${overlayId}-tooltip`} task={task} x={overlay.tooltipX} y={overlay.tooltipY} indicator={indicator} />
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

export function TimelineCreateDraftShape({ draft, headerHeight, height }: { draft: TimelineCreateDraft; headerHeight: number; height: number }) {
  return (
    <g className="planning-owned-create-draft" aria-hidden="true">
      <rect x={draft.x} y={headerHeight + 6} width={draft.width} height={Math.max(28, height - headerHeight - 12)} rx="4" />
      <text x={draft.x + 8} y={headerHeight + 26}>{draft.start} to {draft.end}</text>
    </g>
  );
}

import type { PlanningSchedule, PlanningTask } from "./types";
import {
  dateValue,
  durationBetween,
  durationUnits,
  taskColorClass,
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

export function DependencyLines({ schedule, tasks, taskRows, chartStart, scale, cellWidth, rowSize, headerHeight }: { schedule: PlanningSchedule; tasks: PlanningTask[]; taskRows: Map<string, number>; chartStart: Date; scale: TimelineScale; cellWidth: number; rowSize: number; headerHeight: number }) {
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

export function TaskShape({
  task,
  index,
  chartStart,
  scale,
  cellWidth,
  rowSize,
  headerHeight,
  selected,
  showCritical,
  showBaselines,
  onSelect,
  onDragStart,
}: {
  task: PlanningTask;
  index: number;
  chartStart: Date;
  scale: TimelineScale;
  cellWidth: number;
  rowSize: number;
  headerHeight: number;
  selected: boolean;
  showCritical: boolean;
  showBaselines: boolean;
  onSelect: (taskId: string) => void;
  onDragStart: (taskId: string, mode: "move" | "resize-start" | "resize-end" | "progress", clientX: number, barWidth?: number) => void;
}) {
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
      <g className={className} tabIndex={0} onClick={() => onSelect(task.id)} onPointerDown={(event) => onDragStart(task.id, "move", event.clientX)}>
        <polygon points={`${centerX},${y} ${x + barHeight},${centerY} ${centerX},${y + barHeight} ${x},${centerY}`} />
        <text x={x + barHeight + 6} y={centerY + 4}>{task.title}</text>
      </g>
    );
  }
  const progressWidth = width * Math.max(0, Math.min(100, task.progress)) / 100;
  return (
    <g className={className} tabIndex={0} onClick={() => onSelect(task.id)}>
      {showBaselines && task.baseline_start && task.baseline_end ? <BaselineShape task={task} chartStart={chartStart} scale={scale} cellWidth={cellWidth} y={y + barHeight + 6} /> : null}
      <rect x={x} y={y} width={width} height={barHeight} rx={task.task_type === "summary" ? 1 : 4} onPointerDown={(event) => onDragStart(task.id, "move", event.clientX)} />
      <rect className="progress" x={x} y={y} width={progressWidth} height={barHeight} rx={task.task_type === "summary" ? 1 : 4} />
      <rect className="planning-owned-resize-handle start" x={x - 4} y={y} width="8" height={barHeight} rx="3" onPointerDown={(event) => onDragStart(task.id, "resize-start", event.clientX)} />
      <rect className="planning-owned-resize-handle end" x={x + width - 4} y={y} width="8" height={barHeight} rx="3" onPointerDown={(event) => onDragStart(task.id, "resize-end", event.clientX)} />
      <circle className="planning-owned-progress-handle" cx={x + progressWidth} cy={y + barHeight / 2} r="5" onPointerDown={(event) => onDragStart(task.id, "progress", event.clientX, width)} />
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

export function TodayMarker({ chartStart, scale, cellWidth, height }: { chartStart: Date; scale: TimelineScale; cellWidth: number; height: number }) {
  const x = xForDate(new Date(), chartStart, scale, cellWidth);
  if (x < 0) return null;
  return <line className="planning-owned-today" x1={x} y1="0" x2={x} y2={height} />;
}

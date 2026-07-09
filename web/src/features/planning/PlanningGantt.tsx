import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";

import { useColumnOrder, useResizableColumns } from "../../shared/tables";
import type { PlanningTask } from "./types";
import {
  assignedResourceNames,
  autoFitColumnWidth,
  buildTimeline,
  finishDrag,
  gridColumns,
  rowHeight,
  type DragState,
  type PlanningGridColumn,
  type TimelineScale,
} from "./planningGanttModel";
import { visibleRows } from "./planningGanttTree";
import { DependencyLines, ProjectBoundaryMarkers, TaskShape, TaskTimelineMarkers, TimelineBackground, TimelineCreateDraftShape, TimelineHeaders, TodayMarker } from "./PlanningGanttShapes";
import { PlanningGanttEmptyState } from "./PlanningGanttEmptyState";
import { PlanningGanttGridHeader } from "./PlanningGanttGridHeader";
import { PlanningGanttGridRow } from "./PlanningGanttGridRow";
import type { PlanningGanttProps } from "./planningGanttProps";
import { selectedDependencyChain, taskDependencyChainClass } from "./planningDependencyChain";
import { dependencyLinkPayload, svgPointer, type DependencyLinkDrag } from "./planningDependencyDrag";
import { nextPlanningGridSort, sortPlanningTasks, type PlanningGridSort } from "./planningGridSortModel";
import { planningKeyboardCommand } from "./planningKeyboardModel";
import { pinnedColumnOffsets, pinnedGridColumns } from "./planningPinnedColumns";
import { toResizablePlanningColumn } from "./planningResizableColumns";
import { planningRowLayoutMap, planningRowLayouts, usePlanningRowHeights } from "./planningRowHeights";
import { usePlanningTimelineInteraction } from "./planningTimelineInteraction";
import { taskTimelineMarkers } from "./planningTimelineMarkers";
import { PlanningTaskContextMenu } from "./PlanningTaskContextMenu";
import { useElementBlockSize } from "./useElementBlockSize";
import { usePlanningGanttNavigation } from "./usePlanningGanttNavigation";

export function PlanningGantt({
  schedule,
  appearance,
  scale,
  showCritical,
  showBaselines,
  selectedTaskId,
  fieldPreset,
  columnVisibility,
  collapsedSummaryIds,
  viewDensity,
  todaySignal,
  selectedTaskSignal,
  fitProjectSignal,
  dateTarget,
  dateTargetSignal,
  readOnly,
  onTaskSelect,
  onTaskReschedule,
  onTaskProgress,
  onTaskInlineEdit,
  onDependencyCreate,
  onTimelineTaskCreate,
  onTaskMenuAction,
  onScaleChange,
  onColumnVisible, onColumnsReset,
  onSummaryToggle,
  onViewDensityChange,
}: PlanningGanttProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const [shellRef, shellBlockSize] = useElementBlockSize<HTMLDivElement>();
  const [drag, setDrag] = useState<DragState | null>(null);
  const [linkDrag, setLinkDrag] = useState<DependencyLinkDrag | null>(null);
  const [sort, setSort] = useState<PlanningGridSort>(null);
  const [taskMenu, setTaskMenu] = useState<{ taskId: string; x: number; y: number } | null>(null);
  const rowSize = rowHeight(viewDensity);
  const baseColumns = useMemo(() => gridColumns(fieldPreset), [fieldPreset]);
  const { moveColumnBefore, orderedColumns } = useColumnOrder(baseColumns, `planning.gantt.order.${fieldPreset}`);
  const columns = useMemo(() => pinnedGridColumns(orderedColumns.filter((column) => columnVisibility[column.id] !== false)), [columnVisibility, orderedColumns]);
  const resizeColumns = useMemo(() => columns.map(toResizablePlanningColumn), [columns]);
  const { resetColumnWidth, setColumnWidth, totalWidth, widths } = useResizableColumns(resizeColumns, `planning.gantt.${fieldPreset}`);
  const pinnedOffsets = useMemo(() => pinnedColumnOffsets(columns, widths), [columns, widths]);
  const assignedByTask = useMemo(() => assignedResourceNames(schedule), [schedule]);
  const chart = useMemo(() => buildTimeline(schedule, scale, viewDensity), [scale, schedule, viewDensity]);
  const visibleTasks = useMemo(() => sortPlanningTasks(visibleRows(schedule.tasks, collapsedSummaryIds), sort, assignedByTask), [assignedByTask, collapsedSummaryIds, schedule.tasks, sort]);
  const { resetRowHeight, rowHeights, setRowHeight } = usePlanningRowHeights(schedule.project.id);
  const rowLayoutState = useMemo(() => planningRowLayouts(visibleTasks, rowSize, rowHeights), [rowHeights, rowSize, visibleTasks]);
  const rowLayoutByTask = useMemo(() => planningRowLayoutMap(rowLayoutState.layouts), [rowLayoutState.layouts]);
  const timelineMarkers = useMemo(() => taskTimelineMarkers(visibleTasks), [visibleTasks]);
  const dependencyChain = useMemo(() => selectedDependencyChain(schedule, selectedTaskId), [schedule, selectedTaskId]);
  const width = Math.max(chart.units.length * chart.cellWidth, 480);
  const headerHeight = 54;
  const height = headerHeight + rowLayoutState.totalHeight;
  const shellHeight = Math.max(560, height + 28);
  const canvasHeight = Math.max(height, shellBlockSize);
  const gridWidth = Math.max(totalWidth + 64, 420);
  const gridTemplateColumns = columns.map((column) => `${widths[column.id]}px`).join(" ");
  const menuTask = taskMenu ? visibleTasks.find((task) => task.id === taskMenu.taskId) || null : null;
  const timelineInteraction = usePlanningTimelineInteraction(scrollRef, svgRef, {
    cellWidth: chart.cellWidth,
    chartStart: chart.start,
    onCreateTaskRange: readOnly ? () => undefined : onTimelineTaskCreate,
    onScaleChange,
    scale,
  });

  usePlanningGanttNavigation({
    cellWidth: chart.cellWidth,
    chartStart: chart.start,
    dateTarget,
    dateTargetSignal,
    fitProjectSignal,
    rowRefs,
    scale,
    schedule,
    scrollRef,
    selectedTaskId,
    selectedTaskSignal,
    todaySignal,
    visibleTasks,
  });

  return (
    <div
      className={`planning-gantt-shell planning-owned-gantt planning-owned-${appearance} ${readOnly ? "planning-readonly-mode" : ""} ${linkDrag ? "planning-linking" : ""}`}
      ref={shellRef}
      aria-label="Planning Gantt chart"
      aria-readonly={readOnly}
      style={{ "--planning-gantt-content-height": `${shellHeight}px`, "--planning-grid-width": `${gridWidth}px` } as CSSProperties}
    >
      <div className="planning-owned-grid" role="table" aria-label="Planning task grid">
        <PlanningGanttGridHeader
          assignedByTask={assignedByTask}
          columns={columns}
          gridTemplateColumns={gridTemplateColumns}
          totalWidth={totalWidth}
          widths={widths}
          pinnedOffsets={pinnedOffsets}
          tasks={visibleTasks}
          onColumnMoveBefore={moveColumnBefore}
          onColumnVisible={onColumnVisible} onColumnsReset={onColumnsReset}
          onColumnWidthChange={setColumnWidth}
          onHeaderDoubleClick={handleHeaderDoubleClick} onResetColumnWidth={resetColumnWidth}
          onSort={(columnId) => setSort((current) => nextPlanningGridSort(current, columnId))}
          sort={sort}
        />
        <div className="planning-owned-grid-body">
          {visibleTasks.map((task) => (
            <PlanningGanttGridRow
              key={task.id}
              assignedByTask={assignedByTask}
              chainClass={taskDependencyChainClass(dependencyChain, task.id)}
              columns={columns}
              gridTemplateColumns={gridTemplateColumns}
              isSelected={task.id === selectedTaskId}
              minWidth={totalWidth}
              pinnedOffsets={pinnedOffsets}
              readOnly={readOnly}
              rowHeight={rowLayoutByTask.get(task.id)?.height || rowSize}
              rowRef={(element) => setRowRef(task.id, element)}
              rowSize={rowSize}
              showCritical={showCritical}
              summaryExpanded={!collapsedSummaryIds.has(task.id)}
              task={task}
              onKeyDown={handleRowKey}
              onOpenTaskMenu={openTaskMenu}
              onSelect={onTaskSelect}
              onSummaryToggle={() => onSummaryToggle(task.id)}
              onTaskInlineEdit={onTaskInlineEdit}
              onRowHeightChange={setRowHeight}
              onRowHeightReset={resetRowHeight}
            />
          ))}
          {visibleTasks.length === 0 ? <PlanningGanttEmptyState variant="grid" /> : null}
        </div>
      </div>
      <div
        className={`planning-owned-chart ${timelineInteraction.panning ? "panning" : ""}`}
        ref={scrollRef}
        aria-label="Planning timeline"
        title="Drag empty timeline space to pan. Hold Shift and drag empty space to create a task. Hold Ctrl or Command and use the wheel to zoom."
        onPointerDown={timelineInteraction.onPointerDown}
        onPointerMove={timelineInteraction.onPointerMove}
        onPointerUp={(event) => {
          timelineInteraction.onPointerUp(event);
          if (!drag || readOnly) return;
          finishDrag(event.clientX, drag, chart.cellWidth, scale, visibleTasks, onTaskReschedule, onTaskProgress);
          setDrag(null);
        }}
        onPointerCancel={() => {
          timelineInteraction.onPointerCancel();
          setDrag(null);
          setLinkDrag(null);
        }}
      >
        <svg
          ref={svgRef}
          width={width}
          height={canvasHeight}
          role="img"
          aria-label={`${schedule.project.name} timeline`}
          onPointerMove={(event) => updateLinkPointer(event)}
          onPointerUp={() => setLinkDrag(null)}
        >
          <TimelineHeaders units={chart.units} cellWidth={chart.cellWidth} headerHeight={headerHeight} width={width} />
          <TimelineBackground units={chart.units} cellWidth={chart.cellWidth} headerHeight={headerHeight} height={canvasHeight} rowLayouts={rowLayoutState.layouts} />
          <ProjectBoundaryMarkers project={schedule.project} chartStart={chart.start} scale={scale} cellWidth={chart.cellWidth} height={canvasHeight} />
          <TaskTimelineMarkers markers={timelineMarkers} chartStart={chart.start} scale={scale} cellWidth={chart.cellWidth} height={canvasHeight} />
          <DependencyLines schedule={schedule} tasks={visibleTasks} rowLayoutByTask={rowLayoutByTask} chartStart={chart.start} scale={scale} cellWidth={chart.cellWidth} headerHeight={headerHeight} dependencyChain={dependencyChain} />
          {linkDrag ? <path className="planning-owned-link-draft" d={`M ${linkDrag.sourceX} ${linkDrag.sourceY} L ${linkDrag.pointerX} ${linkDrag.pointerY}`} /> : null}
          {timelineInteraction.createDraft ? <TimelineCreateDraftShape draft={timelineInteraction.createDraft} headerHeight={headerHeight} height={canvasHeight} /> : null}
          {visibleTasks.map((task) => (
            <TaskShape key={task.id} task={task} rowTop={rowLayoutByTask.get(task.id)?.top || 0} chartStart={chart.start} scale={scale} cellWidth={chart.cellWidth} rowSize={rowLayoutByTask.get(task.id)?.height || rowSize} headerHeight={headerHeight} selected={task.id === selectedTaskId} chainClass={taskDependencyChainClass(dependencyChain, task.id)} showCritical={showCritical} showBaselines={showBaselines} readOnly={readOnly} onSelect={onTaskSelect} onDragStart={(taskId, mode, clientX, barWidth) => setDrag({ taskId, mode, startX: clientX, barWidth })} onLinkStart={startDependencyLink} onLinkFinish={finishDependencyLink} />
          ))}
          <TodayMarker chartStart={chart.start} scale={scale} cellWidth={chart.cellWidth} height={canvasHeight} />
        </svg>
        {visibleTasks.length === 0 ? <PlanningGanttEmptyState variant="timeline" /> : null}
      </div>
      <PlanningTaskContextMenu open={Boolean(taskMenu)} task={menuTask} position={taskMenu ? { x: taskMenu.x, y: taskMenu.y } : { x: 0, y: 0 }} onClose={() => setTaskMenu(null)} onAction={onTaskMenuAction} />
    </div>
  );

  function handleHeaderDoubleClick(column: PlanningGridColumn) {
    if (column.id === "task") {
      onViewDensityChange(viewDensity === "compact" ? "standard" : "compact");
      return;
    }
    setColumnWidth(column.id, autoFitColumnWidth(column, visibleTasks, assignedByTask));
  }

  function startDependencyLink(taskId: string, x: number, y: number, event: PointerEvent<SVGCircleElement> | KeyboardEvent<SVGCircleElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (readOnly) return;
    onTaskSelect(taskId);
    setDrag(null);
    setLinkDrag({ sourceTaskId: taskId, sourceX: x, sourceY: y, pointerX: x + 28, pointerY: y });
  }

  function finishDependencyLink(taskId: string, _x: number, _y: number, event: PointerEvent<SVGCircleElement> | KeyboardEvent<SVGCircleElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!linkDrag || readOnly) return;
    const payload = dependencyLinkPayload(schedule, linkDrag.sourceTaskId, taskId);
    setLinkDrag(null);
    onTaskSelect(taskId);
    if (payload) onDependencyCreate(payload);
  }

  function updateLinkPointer(event: PointerEvent<SVGSVGElement>) {
    if (!linkDrag || !svgRef.current) return;
    const point = svgPointer(svgRef.current, event.clientX, event.clientY);
    setLinkDrag({ ...linkDrag, pointerX: point.x, pointerY: point.y });
  }

  function openTaskMenu(taskId: string, x: number, y: number, event: { preventDefault: () => void; stopPropagation: () => void }) {
    event.preventDefault();
    event.stopPropagation();
    if (readOnly) {
      onTaskSelect(taskId);
      return;
    }
    onTaskSelect(taskId);
    setTaskMenu({ taskId, x, y });
  }

  function handleRowKey(task: PlanningTask, event: KeyboardEvent<HTMLDivElement>) {
    const command = planningKeyboardCommand(event, task, visibleTasks);
    if (command.kind === "none") return;
    event.preventDefault();
    if (command.kind === "select") selectAndFocus(command.taskId);
    else if (command.kind === "open-menu") {
      if (readOnly) return;
      const rect = event.currentTarget.getBoundingClientRect();
      openTaskMenu(task.id, rect.left + 24, rect.top + 24, event);
    } else if (command.kind === "toggle-summary") {
      onTaskSelect(task.id);
      onSummaryToggle(task.id);
    } else if (!readOnly) onTaskMenuAction(command.action, task);
  }

  function selectAndFocus(taskId: string) {
    onTaskSelect(taskId);
    rowRefs.current.get(taskId)?.focus();
  }

  function setRowRef(taskId: string, element: HTMLDivElement | null) {
    if (element) rowRefs.current.set(taskId, element);
    else rowRefs.current.delete(taskId);
  }

}

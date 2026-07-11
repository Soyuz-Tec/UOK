import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";

import { useColumnOrder, useResizableColumns } from "@uok/shared/tables";
import { useUokLocalization } from "@uok/shared/localization";
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
import { PlanningGanttGrid } from "./PlanningGanttGrid";
import { taskOverlayGutter } from "./PlanningGanttTaskOverlays";
import type { PlanningGanttProps } from "./planningGanttProps";
import { selectedDependencyChain, taskDependencyChainClass } from "./planningDependencyChain";
import { dependencyLinkPayload, svgPointer, type DependencyLinkDrag } from "./planningDependencyDrag";
import { nextPlanningGridSort, sortPlanningTasks, type PlanningGridSort } from "./planningGridSortModel";
import { planningKeyboardCommand } from "./planningKeyboardModel";
import { pinnedColumnOffsets, pinnedGridColumns } from "./planningPinnedColumns";
import { toResizablePlanningColumn } from "./planningResizableColumns";
import { nextTimelineZoom } from "./planningScaleOptions";
import { planningRowLayoutMap, planningRowLayouts, usePlanningRowHeights } from "./planningRowHeights";
import { usePlanningTimelineInteraction } from "./planningTimelineInteraction";
import { taskTimelineMarkers } from "./planningTimelineMarkers";
import { PlanningTaskContextMenu } from "./PlanningTaskContextMenu";
import { useElementBlockSize } from "./useElementBlockSize";
import { usePlanningGanttNavigation } from "./usePlanningGanttNavigation";
import { usePlanningGanttVirtualization } from "./planningGanttVirtualization";

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
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const pendingFocusRef = useRef<string | null>(null);
  const { t } = useUokLocalization();
  const [setShellElement, shellBlockSize] = useElementBlockSize<HTMLDivElement>();
  const [setChartSizeElement, , chartInlineSize] = useElementBlockSize<HTMLDivElement>();
  const [drag, setDrag] = useState<DragState | null>(null);
  const [chartScrollLeft, setChartScrollLeft] = useState(0);
  const [linkDrag, setLinkDrag] = useState<DependencyLinkDrag | null>(null);
  const [timelineZoom, setTimelineZoom] = useState(1);
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
  const chart = useMemo(() => buildTimeline(schedule, scale, viewDensity, Math.max(0, chartInlineSize - taskOverlayGutter), timelineZoom), [chartInlineSize, scale, schedule, timelineZoom, viewDensity]);
  const visibleTasks = useMemo(() => sortPlanningTasks(visibleRows(schedule.tasks, collapsedSummaryIds), sort, assignedByTask), [assignedByTask, collapsedSummaryIds, schedule.tasks, sort]);
  const { resetRowHeight, rowHeights, setRowHeight } = usePlanningRowHeights(schedule.project.id);
  const rowLayoutState = useMemo(() => planningRowLayouts(visibleTasks, rowSize, rowHeights), [rowHeights, rowSize, visibleTasks]);
  const rowLayoutByTask = useMemo(() => planningRowLayoutMap(rowLayoutState.layouts), [rowLayoutState.layouts]);
  const virtualWindow = usePlanningGanttVirtualization(rowLayoutState.layouts, selectedTaskId, gridScrollRef, scrollRef);
  const renderedTasks = useMemo(() => visibleTasks.slice(virtualWindow.start, virtualWindow.end), [virtualWindow.end, virtualWindow.start, visibleTasks]);
  const renderedLayouts = useMemo(() => rowLayoutState.layouts.slice(virtualWindow.start, virtualWindow.end), [rowLayoutState.layouts, virtualWindow.end, virtualWindow.start]);
  const timelineMarkers = useMemo(() => taskTimelineMarkers(renderedTasks), [renderedTasks]);
  const dependencyChain = useMemo(() => selectedDependencyChain(schedule, selectedTaskId), [schedule, selectedTaskId]);
  const width = Math.max(chart.units.length * chart.cellWidth + taskOverlayGutter, 480);
  const headerHeight = 54;
  const height = headerHeight + rowLayoutState.totalHeight;
  const shellHeight = virtualWindow.virtualized ? 680 : Math.max(560, height + 28);
  const canvasHeight = Math.max(height, shellBlockSize);
  const gridWidth = Math.max(totalWidth + 64, 420);
  const gridTemplateColumns = columns.map((column) => `${widths[column.id]}px`).join(" ");
  const menuTask = taskMenu ? visibleTasks.find((task) => task.id === taskMenu.taskId) || null : null;
  const timelineInteraction = usePlanningTimelineInteraction(scrollRef, svgRef, {
    cellWidth: chart.cellWidth,
    chartStart: chart.start,
    onCreateTaskRange: readOnly ? () => undefined : onTimelineTaskCreate,
    onScaleChange,
    onWheelZoom: (direction) => setTimelineZoom((current) => nextTimelineZoom(current, direction)),
    scale,
  });
  const setChartElement = useCallback((element: HTMLDivElement | null) => {
    scrollRef.current = element;
    setChartSizeElement(element);
  }, [setChartSizeElement]);

  useEffect(() => {
    const taskId = pendingFocusRef.current;
    const row = taskId ? rowRefs.current.get(taskId) : null;
    if (!row) return;
    row.focus();
    pendingFocusRef.current = null;
  }, [renderedTasks]);

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
      ref={setShellElement}
      aria-label={t("planning.gantt")}
      aria-readonly={readOnly}
      style={{ "--planning-gantt-content-height": `${shellHeight}px`, "--planning-grid-width": `${gridWidth}px` } as CSSProperties}
    >
      <PlanningGanttGrid bodyRef={gridScrollRef}
        state={{ allTasks: visibleTasks, assignedByTask, columns, dependencyChain, gridTemplateColumns, pinnedOffsets, readOnly, renderedTasks, rowLayoutByTask, rowSize, selectedTaskId, showCritical, sort, summaryExpanded: (task) => !collapsedSummaryIds.has(task.id), totalHeight: rowLayoutState.totalHeight, totalWidth, virtualized: virtualWindow.virtualized, widths }}
        actions={{ onColumnMoveBefore: moveColumnBefore, onColumnVisible, onColumnsReset, onColumnWidthChange: setColumnWidth, onHeaderDoubleClick: handleHeaderDoubleClick, onKeyDown: handleRowKey, onOpenTaskMenu: openTaskMenu, onResetColumnWidth: resetColumnWidth, onRowHeightChange: setRowHeight, onRowHeightReset: resetRowHeight, onRowRef: setRowRef, onScroll: virtualWindow.onGridScroll, onSelect: onTaskSelect, onSort: (columnId) => setSort((current) => nextPlanningGridSort(current, columnId)), onSummaryToggle, onTaskInlineEdit }} />
      <div
        className={`planning-owned-chart ${timelineInteraction.panning ? "panning" : ""}`}
        ref={setChartElement}
        aria-label={t("planning.timeline")}
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
        onScroll={(event) => {
          setChartScrollLeft(event.currentTarget.scrollLeft);
          virtualWindow.onChartScroll(event);
        }}
      >
        <svg
          ref={svgRef}
          width={width}
          height={canvasHeight}
          role="img"
          aria-label={`${schedule.project.name} ${t("planning.timeline")}`}
          onPointerMove={(event) => updateLinkPointer(event)}
          onPointerUp={() => setLinkDrag(null)}
        >
          <TimelineHeaders units={chart.units} cellWidth={chart.cellWidth} headerHeight={headerHeight} width={width} />
          <TimelineBackground units={chart.units} cellWidth={chart.cellWidth} headerHeight={headerHeight} height={canvasHeight} rowLayouts={renderedLayouts} width={width} />
          <ProjectBoundaryMarkers project={schedule.project} chartStart={chart.start} scale={scale} cellWidth={chart.cellWidth} height={canvasHeight} />
          <TaskTimelineMarkers markers={timelineMarkers} chartStart={chart.start} scale={scale} cellWidth={chart.cellWidth} height={canvasHeight} timelineWidth={width} />
          <DependencyLines schedule={schedule} tasks={renderedTasks} rowLayoutByTask={rowLayoutByTask} chartStart={chart.start} scale={scale} cellWidth={chart.cellWidth} headerHeight={headerHeight} dependencyChain={dependencyChain} />
          {linkDrag ? <path className="planning-owned-link-draft" d={`M ${linkDrag.sourceX} ${linkDrag.sourceY} L ${linkDrag.pointerX} ${linkDrag.pointerY}`} /> : null}
          {timelineInteraction.createDraft ? <TimelineCreateDraftShape draft={timelineInteraction.createDraft} headerHeight={headerHeight} height={canvasHeight} /> : null}
          {renderedTasks.map((task) => (
            <TaskShape key={task.id} task={task} rowTop={rowLayoutByTask.get(task.id)?.top || 0} chartStart={chart.start} scale={scale} cellWidth={chart.cellWidth} rowSize={rowLayoutByTask.get(task.id)?.height || rowSize} headerHeight={headerHeight} timelineWidth={width} viewportLeft={chartScrollLeft} viewportWidth={chartInlineSize || width} selected={task.id === selectedTaskId} chainClass={taskDependencyChainClass(dependencyChain, task.id)} showCritical={showCritical} showBaselines={showBaselines} readOnly={readOnly} onSelect={onTaskSelect} onDragStart={(taskId, mode, clientX, barWidth) => setDrag({ taskId, mode, startX: clientX, barWidth })} onLinkStart={startDependencyLink} onLinkFinish={finishDependencyLink} />
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
    pendingFocusRef.current = taskId;
    onTaskSelect(taskId);
    rowRefs.current.get(taskId)?.focus();
  }

  function setRowRef(taskId: string, element: HTMLDivElement | null) {
    if (element) rowRefs.current.set(taskId, element);
    else rowRefs.current.delete(taskId);
  }

}

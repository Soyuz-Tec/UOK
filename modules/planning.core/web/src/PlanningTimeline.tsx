import { useMemo, useState } from "react";
import { useColumnVisibilityOptions } from "@uok/shared/tables";
import type { Appearance } from "@uok/shared/types";
import type { PlanningBulkTaskUpdate } from "./PlanningBulkEditControls";
import { PlanningCommandSurface } from "./PlanningCommandSurface";
import { PlanningGantt } from "./PlanningGantt";
import { PlanningReadModelView } from "./PlanningReadModelViews";
import type { TimelineScale } from "./planningGanttModel";
import { summaryTaskIds } from "./planningGanttTree";
import type { PlanningHistoryState } from "./planningHistory";
import type { PlanningTaskMenuAction } from "./planningTaskMenuModel";
import type { PlanningSavedViewConfig } from "./planningViewPersistence";
import { planningColumnVisibilityOptions, projectScheduleView, type FieldPreset, type PlanningFilterState, type PlanningLayoutMode, type PlanningView, type ViewDensity } from "./planningTimelineModel";
import type { PlanningProject, PlanningSchedule } from "./types";
import type { PlanningDependencyCreateRequest, PlanningTaskUpdateRequest } from "./planningContracts";

export function PlanningTimeline({
  projects,
  schedule,
  appearance,
  scale,
  showCritical,
  showBaselines,
  reviewMode, reviewModeLocked, reportsOperational,
  selectedTaskId,
  selectedProjectId,
  busy,
  history,
  bulkUpdatesAvailable,
  onScaleChange,
  onToggleCritical,
  onToggleBaselines,
  onReviewModeChange,
  onTaskSelect,
  onTaskReschedule,
  onTaskProgress,
  onTaskInlineEdit,
  onBulkTaskEdit,
  onDependencyCreate,
  onTimelineTaskCreate,
  onTaskMenuAction,
  onProjectChange,
  onCreateDemoSchedule,
  onRefresh,
  onNewTask,
  onOpenDependencies,
  onCreateBaseline,
  onOpenResources,
  onLevelResources,
  onUndo,
  onRedo,
  token,
}: {
  projects: PlanningProject[];
  schedule: PlanningSchedule;
  appearance: Appearance;
  scale: TimelineScale;
  showCritical: boolean;
  showBaselines: boolean;
  reviewMode: boolean; reviewModeLocked: boolean; reportsOperational: boolean;
  selectedTaskId: string;
  selectedProjectId: string;
  busy: string;
  history: PlanningHistoryState;
  bulkUpdatesAvailable: boolean;
  onScaleChange: (scale: TimelineScale) => void;
  onToggleCritical: () => void;
  onToggleBaselines: () => void;
  onReviewModeChange: (reviewMode: boolean) => void;
  onTaskSelect: (taskId: string) => void;
  onTaskReschedule: (taskId: string, start: string, end: string, cascade: boolean) => void;
  onTaskProgress: (taskId: string, progress: number) => void;
  onTaskInlineEdit: (taskId: string, payload: PlanningTaskUpdateRequest, cascade: boolean) => void;
  onBulkTaskEdit: (updates: PlanningBulkTaskUpdate[]) => void;
  onDependencyCreate: (payload: PlanningDependencyCreateRequest) => void;
  onTimelineTaskCreate: (start: string, end: string) => void;
  onTaskMenuAction: (action: PlanningTaskMenuAction, task: PlanningSchedule["tasks"][number]) => void;
  onProjectChange: (projectId: string) => void;
  onCreateDemoSchedule: () => void;
  onRefresh: () => void;
  onNewTask: (taskType: "task" | "milestone") => void;
  onOpenDependencies: () => void;
  onCreateBaseline: () => void;
  onOpenResources: () => void;
  onLevelResources: (horizonDays: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  token: string;
}) {
  const [activeView, setActiveView] = useState<PlanningView>("Gantt chart");
  const [fieldPreset, setFieldPreset] = useState<FieldPreset>("core");
  const [filters, setFilters] = useState<PlanningFilterState>({ mode: "all", query: "", partyId: "", resourceId: "", status: "" });
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [collapsedSummaryIds, setCollapsedSummaryIds] = useState<Set<string>>(new Set());
  const [cascadeSort, setCascadeSort] = useState(true);
  const [cascadeScheduling, setCascadeScheduling] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [layoutMode, setLayoutMode] = useState<PlanningLayoutMode>("split");
  const [viewDensity, setViewDensity] = useState<ViewDensity>("standard");
  const [selectedVisible, setSelectedVisible] = useState(false);
  const [todaySignal, setTodaySignal] = useState(0);
  const [selectedTaskSignal, setSelectedTaskSignal] = useState(0);
  const [fitProjectSignal, setFitProjectSignal] = useState(0);
  const [dateTarget, setDateTarget] = useState(schedule.project.start);
  const [dateTargetSignal, setDateTargetSignal] = useState(0);
  const visibleSchedule = useMemo(() => projectScheduleView(schedule, filters, cascadeSort), [cascadeSort, filters, schedule]);
  const columnOptions = useMemo(() => planningColumnVisibilityOptions(fieldPreset), [fieldPreset]);
  const { resetColumnVisibility, setColumnVisible, visibility: columnVisibility } = useColumnVisibilityOptions(`planning.gantt.columns.${fieldPreset}`, columnOptions);
  const selectedTaskVisible = Boolean(selectedTaskId && visibleSchedule.tasks.some((task) => task.id === selectedTaskId));
  const visibleSelectedTaskId = selectedTaskVisible ? selectedTaskId : "";
  const selectedCount = selectedVisible ? visibleSchedule.tasks.length : selectedTaskVisible ? 1 : 0;
  const selectedTaskIds = selectedVisible ? visibleSchedule.tasks.map((task) => task.id) : visibleSelectedTaskId ? [visibleSelectedTaskId] : [];
  const selectedTasks = useMemo(() => selectedTaskIds.map((taskId) => visibleSchedule.tasks.find((task) => task.id === taskId)).filter((task): task is PlanningSchedule["tasks"][number] => Boolean(task)), [selectedTaskIds, visibleSchedule.tasks]);
  const savedViewConfig = useMemo<PlanningSavedViewConfig>(() => ({
    activeView,
    cascadeScheduling,
    cascadeSort,
    fieldPreset,
    filterMode: filters.mode,
    focusMode,
    layoutMode,
    query: filters.query,
    partyId: filters.partyId,
    reviewMode,
    resourceId: filters.resourceId,
    status: filters.status,
    scale,
    selectedVisible,
    showBaselines,
    showCritical,
    summaryExpanded,
    viewDensity,
  }), [activeView, cascadeScheduling, cascadeSort, fieldPreset, filters.mode, filters.partyId, filters.query, filters.resourceId, filters.status, focusMode, layoutMode, reviewMode, scale, selectedVisible, showBaselines, showCritical, summaryExpanded, viewDensity]);

  return (
    <div className={`planning-timeline-workbench planning-layout-${layoutMode} ${focusMode ? "focus-mode" : ""}`}>
      <PlanningCommandSurface
        model={{
          projects, schedule, visibleSchedule, selectedProjectId, busy, history, bulkUpdatesAvailable,
          activeView, cascadeScheduling, cascadeSort, columnOptions, columnVisibility, currentView: savedViewConfig,
          fieldPreset, filters, focusMode, layoutMode, reviewMode, reviewModeLocked, reportsOperational, scale,
          selectedCount, selectedTaskId: visibleSelectedTaskId, selectedTasks, selectedVisible, showBaselines, showCritical, token, viewDensity,
        }}
        actions={{
          onActiveViewChange: setActiveView, onApplySavedView: applySavedView, onBulkTaskEdit,
          onCascadeSchedulingChange: setCascadeScheduling, onCascadeSortChange: setCascadeSort, onCreateBaseline,
          onCreateDemoSchedule, onDateTarget: goToDate, onFieldPresetChange: setFieldPreset, onFiltersChange: setFilters,
          onFitProject: () => setFitProjectSignal((value) => value + 1), onLevelResources, onNewTask,
          onOpenDependencies, onOpenResources, onProjectChange, onRedo, onRefresh, onReviewModeChange,
          onScaleChange, onSelectedTask: () => setSelectedTaskSignal((value) => value + 1), onSelectedVisibleChange: setSelectedVisible,
          onSetCollapsedSummaries: setCollapsedSummaries, onToday: goToToday, onToggleBaselines, onToggleColumn: setColumnVisible,
          onToggleCritical, onToggleFocusMode: () => setFocusMode((value) => !value),
          onToggleLayoutMode: () => setLayoutMode((value) => value === "split" ? "timeline" : "split"),
          onToggleReviewMode: () => onReviewModeChange(!reviewMode), onResetColumns: resetColumnVisibility, onUndo,
          onViewDensityChange: setViewDensity,
        }}
      />
        {selectedVisible && !bulkUpdatesAvailable ? (
          <div className="planning-bulk-unavailable" role="status">
            Bulk edits require atomic batch support.
          </div>
        ) : null}
      {activeView === "Gantt chart" ? (
        <PlanningGantt
          schedule={visibleSchedule}
          appearance={appearance}
          scale={scale}
          showCritical={showCritical}
          showBaselines={showBaselines}
          selectedTaskId={visibleSelectedTaskId}
          fieldPreset={fieldPreset}
          columnVisibility={columnVisibility}
          collapsedSummaryIds={collapsedSummaryIds}
          viewDensity={viewDensity}
          todaySignal={todaySignal}
          selectedTaskSignal={selectedTaskSignal}
          fitProjectSignal={fitProjectSignal}
          dateTarget={dateTarget}
          dateTargetSignal={dateTargetSignal}
          readOnly={reviewMode}
          onTaskSelect={onTaskSelect}
          onTaskReschedule={(taskId, start, end) => onTaskReschedule(taskId, start, end, cascadeScheduling)}
          onTaskProgress={onTaskProgress}
          onTaskInlineEdit={(taskId, payload) => onTaskInlineEdit(taskId, payload, shouldCascadeEdit(payload))}
          onDependencyCreate={onDependencyCreate}
          onTimelineTaskCreate={onTimelineTaskCreate}
          onTaskMenuAction={onTaskMenuAction}
          onScaleChange={onScaleChange}
          onColumnVisible={setColumnVisible}
          onColumnsReset={resetColumnVisibility}
          onSummaryToggle={toggleSummary}
          onViewDensityChange={setViewDensity}
        />
      ) : (
        <PlanningReadModelView view={activeView} schedule={visibleSchedule} onTaskSelect={onTaskSelect} />
      )}
    </div>
  );

  function applySavedView(config: PlanningSavedViewConfig) {
    setActiveView(config.activeView);
    setCascadeScheduling(config.cascadeScheduling);
    setCascadeSort(config.cascadeSort);
    setFieldPreset(config.fieldPreset);
    setFilters({ mode: config.filterMode, query: config.query, partyId: config.partyId, resourceId: config.resourceId, status: config.status });
    setFocusMode(config.focusMode);
    setLayoutMode(config.layoutMode);
    onReviewModeChange(config.reviewMode);
    setSelectedVisible(config.selectedVisible);
    setSummaryExpanded(config.summaryExpanded);
    setCollapsedSummaries(config.summaryExpanded);
    setViewDensity(config.viewDensity);
    if (scale !== config.scale) onScaleChange(config.scale);
    if (showCritical !== config.showCritical) onToggleCritical();
    if (showBaselines !== config.showBaselines) onToggleBaselines();
  }

  function shouldCascadeEdit(payload: PlanningTaskUpdateRequest) {
    return payload.start || payload.end ? cascadeScheduling : true;
  }

  function goToDate(date: string) {
    setDateTarget(date);
    setDateTargetSignal((value) => value + 1);
  }

  function goToToday() {
    onScaleChange("day");
    setTodaySignal((value) => value + 1);
  }

  function setCollapsedSummaries(expanded: boolean) {
    setSummaryExpanded(expanded);
    setCollapsedSummaryIds(expanded ? new Set() : new Set(summaryTaskIds(schedule.tasks)));
  }

  function toggleSummary(taskId: string) {
    setCollapsedSummaryIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      setSummaryExpanded(next.size === 0);
      return next;
    });
  }
}

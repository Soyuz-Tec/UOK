import { Baseline, FolderKanban, GitBranch, Link2, Maximize2, Milestone, Minimize2, Plus, Redo2, RefreshCw, Rows3, Star, Undo2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { CommandButton, ToggleButton } from "@uok/shared/primitives";
import { useColumnVisibilityOptions } from "@uok/shared/tables";
import type { Appearance } from "@uok/shared/types";
import { PlanningBulkEditControls, type PlanningBulkTaskUpdate } from "./PlanningBulkEditControls";
import { PlanningGantt } from "./PlanningGantt";
import { PlanningLevelingControl } from "./PlanningLevelingControl";
import { PlanningReadModelView } from "./PlanningReadModelViews";
import { PlanningTimelineUtilities } from "./PlanningTimelineUtilities";
import type { TimelineScale } from "./planningGanttModel";
import { summaryTaskIds } from "./planningGanttTree";
import type { PlanningHistoryState } from "./planningHistory";
import type { PlanningTaskMenuAction } from "./planningTaskMenuModel";
import type { PlanningSavedViewConfig } from "./planningViewPersistence";
import { planningColumnVisibilityOptions, planningViews, projectScheduleView, type FieldPreset, type PlanningFilterState, type PlanningLayoutMode, type PlanningView, type ViewDensity } from "./planningTimelineModel";
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
  const selectedCount = selectedVisible ? visibleSchedule.tasks.length : selectedTaskId ? 1 : 0;
  const selectedTaskIds = selectedVisible ? visibleSchedule.tasks.map((task) => task.id) : selectedTaskId ? [selectedTaskId] : [];
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
      <div className="planning-gantt-toolbar" aria-label="Gantt toolbar">
        <div className="planning-toolbar-title">
          <span className="eyebrow">Planning workspace</span>
          <h2>{schedule.project.name}</h2>
          <span>{visibleSchedule.tasks.length} visible of {schedule.tasks.length} tasks, {schedule.dependencies.length} dependencies</span>
        </div>
        <div className="planning-project-meta" aria-label="Project metadata">
          <span className="planning-status-chip">{schedule.project.status || "No status"}</span>
          <span className="planning-owner-chip">Project owner</span>
          <button type="button" className="planning-icon-button" aria-label="Favorite project">
            <Star size={15} aria-hidden="true" />
          </button>
        </div>
        <label className="planning-project-picker">
          <span>Project</span>
          <select value={selectedProjectId} onChange={(event) => onProjectChange(event.target.value)}>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
        <div className="planning-toolbar-group planning-plan-actions" aria-label="Plan actions">
          <CommandButton icon={FolderKanban} onClick={onCreateDemoSchedule} loading={busy === "demo"} disabled={reviewMode}>
            New sample plan
          </CommandButton>
          <CommandButton icon={RefreshCw} onClick={onRefresh} loading={busy === "refresh"}>
            Refresh
          </CommandButton>
          <button type="button" className="planning-icon-button planning-history-control" aria-label="Undo" title={history.undoLabel ? `Undo ${history.undoLabel}` : "Undo"} onClick={onUndo} disabled={reviewMode || !history.canUndo || busy === "undo"}>
            <Undo2 size={16} aria-hidden="true" />
          </button>
          <button type="button" className="planning-icon-button planning-history-control" aria-label="Redo" title={history.redoLabel ? `Redo ${history.redoLabel}` : "Redo"} onClick={onRedo} disabled={reviewMode || !history.canRedo || busy === "redo"}>
            <Redo2 size={16} aria-hidden="true" />
          </button>
        </div>
        <nav className="planning-view-tabs" aria-label="Planning views">
          {planningViews.map((view) => {
            const isCurrent = activeView === view;
            return (
              <button
                key={view}
                type="button"
                className={isCurrent ? "selected" : ""}
                aria-current={activeView === view ? "page" : undefined}
                onClick={() => setActiveView(view)}
              >
                {view}
              </button>
            );
          })}
        </nav>
        <div className="planning-toolbar-group" aria-label="Schedule commands">
          <label className="planning-selection-toggle">
            <input type="checkbox" checked={selectedVisible} onChange={(event) => setSelectedVisible(event.target.checked)} />
            <span>{selectedCount} selected</span>
          </label>
          {selectedVisible ? (
            <PlanningBulkEditControls
              busy={busy === "bulk-task"}
              disabled={reviewMode || !bulkUpdatesAvailable}
              selectedTasks={selectedTasks}
              onBulkTaskEdit={onBulkTaskEdit}
            />
          ) : null}
          <CommandButton icon={Plus} onClick={() => onNewTask("task")} disabled={reviewMode} primary>Task</CommandButton>
          <CommandButton icon={Milestone} onClick={() => onNewTask("milestone")} disabled={reviewMode}>Milestone</CommandButton>
          <CommandButton icon={Link2} onClick={onOpenDependencies} disabled={reviewMode}>Link</CommandButton>
          <ToggleButton icon={Maximize2} className="planning-toolbar-toggle" onClick={() => setCollapsedSummaries(true)}>Expand</ToggleButton>
          <ToggleButton icon={Minimize2} className="planning-toolbar-toggle" onClick={() => setCollapsedSummaries(false)}>Collapse</ToggleButton>
          <ToggleButton icon={Rows3} className="planning-toolbar-toggle" aria-label="WBS order" pressed={cascadeSort} onClick={() => setCascadeSort((value) => !value)}>WBS</ToggleButton>
          <ToggleButton icon={GitBranch} className="planning-toolbar-toggle" aria-label="Cascade scheduling" pressed={cascadeScheduling} onClick={() => setCascadeScheduling((value) => !value)} disabled={reviewMode}>Cascade</ToggleButton>
          <CommandButton icon={Baseline} onClick={onCreateBaseline} disabled={reviewMode || schedule.capabilities?.baseline_create !== true}>Baseline</CommandButton>
          <CommandButton icon={Users} onClick={onOpenResources} disabled={reviewMode}>Resources</CommandButton>
          <PlanningLevelingControl busy={busy === "level"} disabled={reviewMode || schedule.capabilities?.level !== true} onLevel={onLevelResources} />
        </div>
          <PlanningTimelineUtilities columnOptions={columnOptions} columnVisibility={columnVisibility} currentView={savedViewConfig} fieldPreset={fieldPreset} filters={filters} focusMode={focusMode} layoutMode={layoutMode} reviewMode={reviewMode} reviewModeLocked={reviewModeLocked} reportsOperational={reportsOperational} onApplySavedView={applySavedView} onDateTarget={goToDate} onFieldPresetChange={setFieldPreset} onFitProject={() => setFitProjectSignal((value) => value + 1)} onFiltersChange={setFilters} onScaleChange={onScaleChange} onToggleBaselines={onToggleBaselines} onToggleCritical={onToggleCritical} onToggleColumn={setColumnVisible} onToggleFocusMode={() => setFocusMode((value) => !value)} onToggleLayoutMode={() => setLayoutMode((value) => value === "split" ? "timeline" : "split")} onToggleReviewMode={() => onReviewModeChange(!reviewMode)} onResetColumns={resetColumnVisibility} onSelectedTask={() => setSelectedTaskSignal((value) => value + 1)} onToday={goToToday} onViewDensityChange={setViewDensity} projectStart={schedule.project.start} scale={scale} schedule={visibleSchedule} selectedTaskId={selectedTaskId} showBaselines={showBaselines} showCritical={showCritical} token={token} viewDensity={viewDensity} />
        </div>
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
          selectedTaskId={selectedTaskId}
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

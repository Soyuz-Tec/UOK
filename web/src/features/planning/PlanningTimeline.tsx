import { Baseline, FolderKanban, Link2, Maximize2, Milestone, Minimize2, Plus, RefreshCw, Rows3, Star, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { CommandButton } from "../../shared/primitives";
import { useColumnVisibilityOptions } from "../../shared/tables";
import type { Appearance } from "../../shared/types";
import { PlanningGantt } from "./PlanningGantt";
import { PlanningReadModelView } from "./PlanningReadModelViews";
import { PlanningTimelineUtilities } from "./PlanningTimelineUtilities";
import type { TimelineScale } from "./planningGanttModel";
import type { PlanningTaskMenuAction } from "./planningTaskMenuModel";
import type { PlanningSavedViewConfig } from "./planningViewPersistence";
import { planningColumnVisibilityOptions, planningViews, projectScheduleView, type FieldPreset, type PlanningFilterState, type PlanningLayoutMode, type PlanningView, type ViewDensity } from "./planningTimelineModel";
import type { PlanningProject, PlanningSchedule } from "./types";

export function PlanningTimeline({
  projects,
  schedule,
  appearance,
  scale,
  showCritical,
  showBaselines,
  reviewMode,
  selectedTaskId,
  selectedProjectId,
  busy,
  onScaleChange,
  onToggleCritical,
  onToggleBaselines,
  onReviewModeChange,
  onTaskSelect,
  onTaskReschedule,
  onTaskProgress,
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
}: {
  projects: PlanningProject[];
  schedule: PlanningSchedule;
  appearance: Appearance;
  scale: TimelineScale;
  showCritical: boolean;
  showBaselines: boolean;
  reviewMode: boolean;
  selectedTaskId: string;
  selectedProjectId: string;
  busy: string;
  onScaleChange: (scale: TimelineScale) => void;
  onToggleCritical: () => void;
  onToggleBaselines: () => void;
  onReviewModeChange: (reviewMode: boolean) => void;
  onTaskSelect: (taskId: string) => void;
  onTaskReschedule: (taskId: string, start: string, end: string) => void;
  onTaskProgress: (taskId: string, progress: number) => void;
  onDependencyCreate: (payload: Record<string, unknown>) => void;
  onTimelineTaskCreate: (start: string, end: string) => void;
  onTaskMenuAction: (action: PlanningTaskMenuAction, task: PlanningSchedule["tasks"][number]) => void;
  onProjectChange: (projectId: string) => void;
  onCreateDemoSchedule: () => void;
  onRefresh: () => void;
  onNewTask: (taskType: "task" | "milestone") => void;
  onOpenDependencies: () => void;
  onCreateBaseline: () => void;
  onOpenResources: () => void;
}) {
  const [activeView, setActiveView] = useState<PlanningView>("Gantt chart");
  const [fieldPreset, setFieldPreset] = useState<FieldPreset>("core");
  const [filters, setFilters] = useState<PlanningFilterState>({ mode: "all", query: "", resourceId: "", status: "" });
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [cascadeSort, setCascadeSort] = useState(true);
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
  const savedViewConfig = useMemo<PlanningSavedViewConfig>(() => ({
    activeView,
    cascadeSort,
    fieldPreset,
    filterMode: filters.mode,
    focusMode,
    layoutMode,
    query: filters.query,
    reviewMode,
    resourceId: filters.resourceId,
    status: filters.status,
    scale,
    selectedVisible,
    showBaselines,
    showCritical,
    summaryExpanded,
    viewDensity,
  }), [activeView, cascadeSort, fieldPreset, filters.mode, filters.query, filters.resourceId, filters.status, focusMode, layoutMode, reviewMode, scale, selectedVisible, showBaselines, showCritical, summaryExpanded, viewDensity]);

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
          <CommandButton icon={Plus} onClick={() => onNewTask("task")} disabled={reviewMode} primary>Task</CommandButton>
          <CommandButton icon={Milestone} onClick={() => onNewTask("milestone")} disabled={reviewMode}>Milestone</CommandButton>
          <CommandButton icon={Link2} onClick={onOpenDependencies} disabled={reviewMode}>Link</CommandButton>
          <button type="button" className="planning-toolbar-toggle" onClick={() => setSummaryExpanded(true)}>
            <Maximize2 size={16} aria-hidden="true" />
            <span>Expand all</span>
          </button>
          <button type="button" className="planning-toolbar-toggle" onClick={() => setSummaryExpanded(false)}>
            <Minimize2 size={16} aria-hidden="true" />
            <span>Collapse all</span>
          </button>
          <button type="button" className={`planning-toolbar-toggle ${cascadeSort ? "selected" : ""}`} aria-pressed={cascadeSort} onClick={() => setCascadeSort((value) => !value)}>
            <Rows3 size={16} aria-hidden="true" />
            <span>Cascade sorting</span>
          </button>
          <CommandButton icon={Baseline} onClick={onCreateBaseline} disabled={reviewMode}>Baseline</CommandButton>
          <CommandButton icon={Users} onClick={onOpenResources} disabled={reviewMode}>Resources</CommandButton>
        </div>
        <PlanningTimelineUtilities columnOptions={columnOptions} columnVisibility={columnVisibility} currentView={savedViewConfig} fieldPreset={fieldPreset} filters={filters} focusMode={focusMode} layoutMode={layoutMode} reviewMode={reviewMode} onApplySavedView={applySavedView} onDateTarget={goToDate} onFieldPresetChange={setFieldPreset} onFitProject={() => setFitProjectSignal((value) => value + 1)} onFiltersChange={setFilters} onScaleChange={onScaleChange} onToggleBaselines={onToggleBaselines} onToggleCritical={onToggleCritical} onToggleColumn={setColumnVisible} onToggleFocusMode={() => setFocusMode((value) => !value)} onToggleLayoutMode={() => setLayoutMode((value) => value === "split" ? "timeline" : "split")} onToggleReviewMode={() => onReviewModeChange(!reviewMode)} onResetColumns={resetColumnVisibility} onSelectedTask={() => setSelectedTaskSignal((value) => value + 1)} onToday={goToToday} onViewDensityChange={setViewDensity} projectStart={schedule.project.start} scale={scale} schedule={visibleSchedule} selectedTaskId={selectedTaskId} showBaselines={showBaselines} showCritical={showCritical} viewDensity={viewDensity} />
      </div>
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
          summaryExpanded={summaryExpanded}
          viewDensity={viewDensity}
          todaySignal={todaySignal}
          selectedTaskSignal={selectedTaskSignal}
          fitProjectSignal={fitProjectSignal}
          dateTarget={dateTarget}
          dateTargetSignal={dateTargetSignal}
          readOnly={reviewMode}
          onTaskSelect={onTaskSelect}
          onTaskReschedule={onTaskReschedule}
          onTaskProgress={onTaskProgress}
          onDependencyCreate={onDependencyCreate}
          onTimelineTaskCreate={onTimelineTaskCreate}
          onTaskMenuAction={onTaskMenuAction}
          onScaleChange={onScaleChange}
          onColumnVisible={setColumnVisible}
          onColumnsReset={resetColumnVisibility}
          onSummaryExpandedChange={setSummaryExpanded}
          onViewDensityChange={setViewDensity}
        />
      ) : (
        <PlanningReadModelView view={activeView} schedule={visibleSchedule} onTaskSelect={onTaskSelect} />
      )}
    </div>
  );

  function applySavedView(config: PlanningSavedViewConfig) {
    setActiveView(config.activeView);
    setCascadeSort(config.cascadeSort);
    setFieldPreset(config.fieldPreset);
    setFilters({ mode: config.filterMode, query: config.query, resourceId: config.resourceId, status: config.status });
    setFocusMode(config.focusMode);
    setLayoutMode(config.layoutMode);
    onReviewModeChange(config.reviewMode);
    setSelectedVisible(config.selectedVisible);
    setSummaryExpanded(config.summaryExpanded);
    setViewDensity(config.viewDensity);
    if (scale !== config.scale) onScaleChange(config.scale);
    if (showCritical !== config.showCritical) onToggleCritical();
    if (showBaselines !== config.showBaselines) onToggleBaselines();
  }

  function goToDate(date: string) {
    setDateTarget(date);
    setDateTargetSignal((value) => value + 1);
  }

  function goToToday() {
    onScaleChange("day");
    setTodaySignal((value) => value + 1);
  }
}

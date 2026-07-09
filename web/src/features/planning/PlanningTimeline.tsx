import { Baseline, CalendarClock, ChevronDown, Columns3, Download, Flag, FolderKanban, Link2, Maximize2, Milestone, Minimize2, Plus, RefreshCw, Rows3, Star, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { CommandButton } from "../../shared/primitives";
import { FieldVisibilityMenu, useColumnVisibilityOptions } from "../../shared/tables";
import type { Appearance } from "../../shared/types";
import { PlanningFilters } from "./PlanningFilters";
import { PlanningGantt } from "./PlanningGantt";
import { PlanningReadModelView } from "./PlanningReadModelViews";
import { PlanningSavedViews } from "./PlanningSavedViews";
import type { PlanningSavedViewConfig } from "./planningViewPersistence";
import { exportScheduleCsv, planningColumnVisibilityOptions, planningViews, projectScheduleView, type FieldPreset, type PlanningFilterState, type PlanningView, type ViewDensity } from "./planningTimelineModel";
import type { PlanningProject, PlanningSchedule } from "./types";

export function PlanningTimeline({
  projects,
  schedule,
  appearance,
  scale,
  showCritical,
  showBaselines,
  selectedTaskId,
  selectedProjectId,
  busy,
  onScaleChange,
  onToggleCritical,
  onToggleBaselines,
  onTaskSelect,
  onTaskReschedule,
  onTaskProgress,
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
  scale: "day" | "week" | "month";
  showCritical: boolean;
  showBaselines: boolean;
  selectedTaskId: string;
  selectedProjectId: string;
  busy: string;
  onScaleChange: (scale: "day" | "week" | "month") => void;
  onToggleCritical: () => void;
  onToggleBaselines: () => void;
  onTaskSelect: (taskId: string) => void;
  onTaskReschedule: (taskId: string, start: string, end: string) => void;
  onTaskProgress: (taskId: string, progress: number) => void;
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
  const [viewDensity, setViewDensity] = useState<ViewDensity>("standard");
  const [selectedVisible, setSelectedVisible] = useState(false);
  const [todaySignal, setTodaySignal] = useState(0);
  const visibleSchedule = useMemo(() => projectScheduleView(schedule, filters, cascadeSort), [cascadeSort, filters, schedule]);
  const columnOptions = useMemo(() => planningColumnVisibilityOptions(fieldPreset), [fieldPreset]);
  const { resetColumnVisibility, setColumnVisible, visibility: columnVisibility } = useColumnVisibilityOptions(`planning.gantt.columns.${fieldPreset}`, columnOptions);
  const selectedCount = selectedVisible ? visibleSchedule.tasks.length : selectedTaskId ? 1 : 0;
  const savedViewConfig = useMemo<PlanningSavedViewConfig>(() => ({
    activeView,
    cascadeSort,
    fieldPreset,
    filterMode: filters.mode,
    query: filters.query,
    resourceId: filters.resourceId,
    status: filters.status,
    scale,
    selectedVisible,
    showBaselines,
    showCritical,
    summaryExpanded,
    viewDensity,
  }), [activeView, cascadeSort, fieldPreset, filters.mode, filters.query, filters.resourceId, filters.status, scale, selectedVisible, showBaselines, showCritical, summaryExpanded, viewDensity]);

  return (
    <div className="planning-timeline-workbench">
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
          <CommandButton icon={FolderKanban} onClick={onCreateDemoSchedule} loading={busy === "demo"}>
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
          <CommandButton icon={Plus} onClick={() => onNewTask("task")} primary>Task</CommandButton>
          <CommandButton icon={Milestone} onClick={() => onNewTask("milestone")}>Milestone</CommandButton>
          <CommandButton icon={Link2} onClick={onOpenDependencies}>Link</CommandButton>
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
          <CommandButton icon={Baseline} onClick={onCreateBaseline}>Baseline</CommandButton>
          <CommandButton icon={Users} onClick={onOpenResources}>Resources</CommandButton>
        </div>
        <div className="planning-toolbar-group" aria-label="Timeline utilities">
          <PlanningSavedViews current={savedViewConfig} onApply={applySavedView} />
          <label className="planning-toolbar-select">
            <Columns3 size={16} aria-hidden="true" />
            <span>Fields</span>
            <select value={fieldPreset} onChange={(event) => setFieldPreset(event.target.value as FieldPreset)}>
              <option value="core">Core</option>
              <option value="progress">Progress</option>
              <option value="resources">Resources</option>
            </select>
          </label>
          <FieldVisibilityMenu
            label="Columns"
            options={columnOptions}
            resetLabel="Reset columns"
            visibility={columnVisibility}
            onReset={resetColumnVisibility}
            onToggle={setColumnVisible}
          />
          <PlanningFilters filters={filters} schedule={schedule} onChange={setFilters} />
          <label className="planning-zoom-control">
            <span>Zoom</span>
            <input
              type="range"
              min="0"
              max="2"
              value={scale === "month" ? 0 : scale === "week" ? 1 : 2}
              aria-label="Timeline zoom"
              onChange={(event) => onScaleChange(event.target.value === "0" ? "month" : event.target.value === "1" ? "week" : "day")}
            />
          </label>
          <div className="planning-segmented-control" aria-label="Timeline scale">
            {(["day", "week", "month"] as const).map((item) => (
              <button key={item} type="button" className={scale === item ? "selected" : ""} onClick={() => onScaleChange(item)}>
                {item}
              </button>
            ))}
          </div>
          <button type="button" className="planning-toolbar-toggle" onClick={() => {
            onScaleChange("day");
            setTodaySignal((value) => value + 1);
          }}>
            <CalendarClock size={16} aria-hidden="true" />
            <span>Today</span>
          </button>
          <button type="button" className="planning-toolbar-toggle" onClick={() => onScaleChange("month")}>
            <Maximize2 size={16} aria-hidden="true" />
            <span>Fit</span>
          </button>
          <button type="button" className="planning-toolbar-toggle" onClick={() => exportScheduleCsv(visibleSchedule)}>
            <Download size={16} aria-hidden="true" />
            <span>Export</span>
          </button>
          <label className="planning-toolbar-select">
            <ChevronDown size={16} aria-hidden="true" />
            <span>View</span>
            <select value={viewDensity} onChange={(event) => setViewDensity(event.target.value as ViewDensity)}>
              <option value="compact">Compact</option>
              <option value="standard">Standard</option>
              <option value="roomy">Roomy</option>
            </select>
          </label>
          <button type="button" className={`planning-toolbar-toggle ${showCritical ? "selected" : ""}`} aria-pressed={showCritical} onClick={onToggleCritical}>
            <Flag size={16} aria-hidden="true" />
            <span>Critical</span>
          </button>
          <button type="button" className={`planning-toolbar-toggle ${showBaselines ? "selected" : ""}`} aria-pressed={showBaselines} onClick={onToggleBaselines}>
            <Baseline size={16} aria-hidden="true" />
            <span>Baselines</span>
          </button>
        </div>
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
          onTaskSelect={onTaskSelect}
          onTaskReschedule={onTaskReschedule}
          onTaskProgress={onTaskProgress}
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
    setSelectedVisible(config.selectedVisible);
    setSummaryExpanded(config.summaryExpanded);
    setViewDensity(config.viewDensity);
    if (scale !== config.scale) onScaleChange(config.scale);
    if (showCritical !== config.showCritical) onToggleCritical();
    if (showBaselines !== config.showBaselines) onToggleBaselines();
  }
}

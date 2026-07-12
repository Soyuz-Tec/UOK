import { FolderKanban, FolderPlus, Plus, Redo2, RefreshCw, Star, Undo2 } from "lucide-react";
import { useMemo, type Dispatch, type SetStateAction } from "react";

import { SearchWorkspace } from "@uok/shared/forms";
import { WorkspaceCommandBar } from "@uok/shared/layout";
import { useUokLocalization } from "@uok/shared/localization";
import { CommandButton } from "@uok/shared/primitives";
import type { ColumnVisibilityMap } from "@uok/shared/tables";
import type { PlanningBulkTaskUpdate } from "./PlanningBulkEditControls";
import { PlanningTimelineUtilities } from "./PlanningTimelineUtilities";
import type { TimelineScale } from "./planningGanttModel";
import type { PlanningHistoryState } from "./planningHistory";
import type { PlanningSavedViewConfig } from "./planningViewPersistence";
import { planningViews, type FieldPreset, type PlanningFilterState, type PlanningLayoutMode, type PlanningView, type ViewDensity } from "./planningTimelineModel";
import type { PlanningProject, PlanningSchedule } from "./types";

type PlanningCommandSurfaceModel = {
  projects: PlanningProject[];
  schedule: PlanningSchedule;
  visibleSchedule: PlanningSchedule;
  selectedProjectId: string;
  busy: string;
  history: PlanningHistoryState;
  bulkUpdatesAvailable: boolean;
  canCreateProject: boolean;
  activeView: PlanningView;
  cascadeScheduling: boolean;
  cascadeSort: boolean;
  columnOptions: { id: string; label: string }[];
  columnVisibility: ColumnVisibilityMap;
  currentView: PlanningSavedViewConfig;
  fieldPreset: FieldPreset;
  filters: PlanningFilterState;
  focusMode: boolean;
  layoutMode: PlanningLayoutMode;
  reviewMode: boolean;
  reviewModeLocked: boolean;
  reportsOperational: boolean;
  scale: TimelineScale;
  selectedCount: number;
  selectedTaskId: string;
  selectedTasks: PlanningSchedule["tasks"];
  selectedVisible: boolean;
  showBaselines: boolean;
  showCritical: boolean;
  token: string;
  viewDensity: ViewDensity;
};

type PlanningCommandSurfaceActions = {
  onActiveViewChange: (view: PlanningView) => void;
  onApplySavedView: (config: PlanningSavedViewConfig) => void;
  onBulkTaskEdit: (updates: PlanningBulkTaskUpdate[]) => void;
  onCascadeSchedulingChange: Dispatch<SetStateAction<boolean>>;
  onCascadeSortChange: Dispatch<SetStateAction<boolean>>;
  onCreateBaseline: () => void;
  onCreateDemoSchedule: () => void;
  onDateTarget: (date: string) => void;
  onFieldPresetChange: (preset: FieldPreset) => void;
  onFiltersChange: Dispatch<SetStateAction<PlanningFilterState>>;
  onFitProject: () => void;
  onLevelResources: (horizonDays: number) => void;
  onNewTask: (taskType: "task" | "milestone") => void;
  onOpenDependencies: () => void;
  onOpenResources: () => void;
  onProjectChange: (projectId: string) => void;
  onNewProject: () => void;
  onRedo: () => void;
  onRefresh: () => void;
  onReviewModeChange: (reviewMode: boolean) => void;
  onScaleChange: (scale: TimelineScale) => void;
  onSelectedTask: () => void;
  onSelectedVisibleChange: (selected: boolean) => void;
  onSetCollapsedSummaries: (expanded: boolean) => void;
  onToday: () => void;
  onToggleBaselines: () => void;
  onToggleColumn: (columnId: string, visible: boolean) => void;
  onToggleCritical: () => void;
  onToggleFocusMode: () => void;
  onToggleLayoutMode: () => void;
  onToggleReviewMode: () => void;
  onResetColumns: () => void;
  onUndo: () => void;
  onViewDensityChange: (density: ViewDensity) => void;
};

const filterModeOptions = [
  { value: "all", label: "All tasks" },
  { value: "critical", label: "Critical path" },
  { value: "milestones", label: "Milestones" },
  { value: "not_ready", label: "Not ready" },
];

export function PlanningCommandSurface({ model, actions }: {
  model: PlanningCommandSurfaceModel;
  actions: PlanningCommandSurfaceActions;
}) {
  const { t } = useUokLocalization();
  const statusOptions = useMemo(() => [
    { value: "", label: "Any status" },
    ...Array.from(new Set(model.schedule.tasks.map((task) => task.status || "planned"))).sort().map((status) => ({ value: status, label: status })),
  ], [model.schedule.tasks]);
  const participantOptions = useMemo(() => [
    { value: "", label: "Any participant" },
    ...Array.from(new Map((model.schedule.participants || []).filter((row) => row.party.id && row.resolution.display_label).map((row) => [row.party.id as string, row])).values())
      .map((participant) => ({ value: participant.party.id as string, label: participant.resolution.display_label || "Unnamed participant" })),
  ], [model.schedule.participants]);
  const resourceOptions = useMemo(() => [
    { value: "", label: "Any resource" },
    ...model.schedule.resources.map((resource) => ({ value: resource.id, label: resource.name })),
  ], [model.schedule.resources]);

  return <>
    <header className="planning-workspace-heading">
      <div className="planning-toolbar-title">
        <span className="eyebrow">Planning workspace</span>
        <h2>{model.schedule.project.name}</h2>
        <span>{model.visibleSchedule.tasks.length} visible of {model.schedule.tasks.length} tasks, {model.schedule.dependencies.length} dependencies</span>
      </div>
      <div className="planning-project-meta" aria-label="Project metadata">
        <span className="planning-status-chip">{model.schedule.project.status || "No status"}</span>
        <span className="planning-owner-chip">Project owner</span>
        <button type="button" className="planning-icon-button" aria-label="Favorite project"><Star size={15} aria-hidden="true" /></button>
      </div>
    </header>
    <WorkspaceCommandBar
      className="planning-command-bar"
      label="Planning commands"
      query={<SearchWorkspace
        label="Search planning tasks"
        value={model.filters.query}
        placeholder="Search tasks"
        defaultSummaryLabel="All tasks"
        filters={[
          { id: "mode", label: "Task set", value: model.filters.mode, defaultValue: "all", options: filterModeOptions, onChange: (mode) => actions.onFiltersChange((current) => ({ ...current, mode: mode as PlanningFilterState["mode"] })) },
          { id: "status", label: "Status", value: model.filters.status, defaultValue: "", options: statusOptions, onChange: (status) => actions.onFiltersChange((current) => ({ ...current, status })) },
          { id: "participant", label: "Participant", value: model.filters.partyId, defaultValue: "", options: participantOptions, onChange: (partyId) => actions.onFiltersChange((current) => ({ ...current, partyId })) },
          { id: "resource", label: "Resource", value: model.filters.resourceId, defaultValue: "", options: resourceOptions, onChange: (resourceId) => actions.onFiltersChange((current) => ({ ...current, resourceId })) },
        ]}
        groupBy="none"
        groupOptions={[]}
        savedViewsStorageKey="planning.gantt.searchViews"
        supplementalSections={({ close }) => <section className="search-workspace-section planning-search-plan-actions" aria-label="Plan actions">
          <h3><FolderKanban size={16} aria-hidden="true" /> Plan actions</h3>
          <div className="planning-search-plan-action-list">
            <CommandButton icon={FolderPlus} onClick={() => { close(); actions.onNewProject(); }} disabled={!model.canCreateProject || Boolean(model.busy)}>{t("planning.projectCreate.action", "New project")}</CommandButton>
            <CommandButton icon={FolderKanban} onClick={() => { actions.onCreateDemoSchedule(); close(); }} loading={model.busy === "demo"} disabled={model.reviewMode}>New sample plan</CommandButton>
            <CommandButton icon={RefreshCw} onClick={() => { actions.onRefresh(); close(); }} loading={model.busy === "refresh"}>Refresh</CommandButton>
            <button type="button" className="command-button planning-history-control" aria-label="Undo" title={model.history.undoLabel ? `Undo ${model.history.undoLabel}` : "Undo"} onClick={() => { actions.onUndo(); close(); }} disabled={model.reviewMode || !model.history.canUndo || model.busy === "undo"}>
              <Undo2 size={16} aria-hidden="true" /><span>Undo</span>
            </button>
            <button type="button" className="command-button planning-history-control" aria-label="Redo" title={model.history.redoLabel ? `Redo ${model.history.redoLabel}` : "Redo"} onClick={() => { actions.onRedo(); close(); }} disabled={model.reviewMode || !model.history.canRedo || model.busy === "redo"}>
              <Redo2 size={16} aria-hidden="true" /><span>Redo</span>
            </button>
          </div>
        </section>}
        onChange={(query) => actions.onFiltersChange((current) => ({ ...current, query }))}
        onGroupByChange={() => undefined}
        onClear={() => actions.onFiltersChange({ mode: "all", query: "", partyId: "", resourceId: "", status: "" })}
      />}
      context={<label className="planning-project-picker">
        <span>Project</span>
        <select value={model.selectedProjectId} onChange={(event) => actions.onProjectChange(event.target.value)}>
          {model.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
      </label>}
      view={<nav className="planning-view-tabs" aria-label="Planning views">
        {planningViews.map((view) => <button key={view} type="button" className={model.activeView === view ? "selected" : ""} aria-current={model.activeView === view ? "page" : undefined} onClick={() => actions.onActiveViewChange(view)}>{view}</button>)}
      </nav>}
      fields={<PlanningTimelineUtilities
        columnOptions={model.columnOptions} columnVisibility={model.columnVisibility} currentView={model.currentView}
        busy={model.busy} bulkUpdatesAvailable={model.bulkUpdatesAvailable} cascadeScheduling={model.cascadeScheduling} cascadeSort={model.cascadeSort}
        fieldPreset={model.fieldPreset}
        focusMode={model.focusMode} layoutMode={model.layoutMode} reviewMode={model.reviewMode} reviewModeLocked={model.reviewModeLocked}
        reportsOperational={model.reportsOperational} onApplySavedView={actions.onApplySavedView} onBulkTaskEdit={actions.onBulkTaskEdit}
        onCascadeSchedulingChange={() => actions.onCascadeSchedulingChange((value) => !value)} onCascadeSortChange={() => actions.onCascadeSortChange((value) => !value)}
        onCreateBaseline={actions.onCreateBaseline} onDateTarget={actions.onDateTarget} onFieldPresetChange={actions.onFieldPresetChange}
        onFitProject={actions.onFitProject} onLevelResources={actions.onLevelResources} onNewMilestone={() => actions.onNewTask("milestone")}
        onOpenDependencies={actions.onOpenDependencies} onOpenResources={actions.onOpenResources} onScaleChange={actions.onScaleChange}
        onToggleBaselines={actions.onToggleBaselines} onToggleCritical={actions.onToggleCritical} onToggleColumn={actions.onToggleColumn}
        onToggleFocusMode={actions.onToggleFocusMode} onToggleLayoutMode={actions.onToggleLayoutMode} onToggleReviewMode={actions.onToggleReviewMode}
        onResetColumns={actions.onResetColumns} onSelectedTask={actions.onSelectedTask} onSelectedVisibleChange={actions.onSelectedVisibleChange}
        onSetCollapsedSummaries={actions.onSetCollapsedSummaries} onToday={actions.onToday} onViewDensityChange={actions.onViewDensityChange}
        projectStart={model.schedule.project.start} scale={model.scale} schedule={model.visibleSchedule} selectedCount={model.selectedCount}
        selectedTaskId={model.selectedTaskId} selectedTasks={model.selectedTasks} selectedVisible={model.selectedVisible}
        showBaselines={model.showBaselines} showCritical={model.showCritical} token={model.token} viewDensity={model.viewDensity}
      />}
      primaryAction={<CommandButton icon={Plus} onClick={() => actions.onNewTask("task")} disabled={model.reviewMode} primary>New task</CommandButton>}
    />
  </>;
}

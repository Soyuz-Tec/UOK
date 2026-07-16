import { FolderKanban, LayoutPanelTop, Redo2, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";

import { ConfirmCommandButton, WorkspaceActionButton } from "@uok/shared/actions";
import { SearchWorkspace } from "@uok/shared/forms";
import { WorkspaceCommandBar } from "@uok/shared/layout";
import { useUokLocalization } from "@uok/shared/localization";
import type { ColumnVisibilityMap } from "@uok/shared/tables";
import type { PlanningBulkTaskUpdate } from "./PlanningBulkEditControls";
import { PlanningScheduleHealth } from "./PlanningScheduleHealth";
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
  canTransitionProject: boolean;
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
  onShowInspector: () => void;
  onOpenResources: () => void;
  onProjectChange: (projectId: string) => void;
  onNewProject: () => void;
  onDeleteProject: (reason: string) => Promise<void>;
  onRestoreProject: (reason: string) => Promise<void>;
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

const planningViewMessageKeys: Record<PlanningView, string> = {
  "Gantt chart": "planning.view.ganttChart",
  Board: "planning.view.board",
  List: "planning.view.list",
  Calendar: "planning.view.calendar",
  Workload: "planning.view.workload",
  People: "planning.view.people",
  Dashboard: "planning.view.dashboard",
};

export function PlanningCommandSurface({ model, actions }: {
  model: PlanningCommandSurfaceModel;
  actions: PlanningCommandSurfaceActions;
}) {
  const { t } = useUokLocalization();
  const lifecycleActionRef = useRef<HTMLDivElement>(null);
  const previousLifecycleRef = useRef({ id: model.schedule.project.id, status: model.schedule.project.status });
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
  const pickerProjects = useMemo(
    () => model.projects.filter((project) => project.status !== "archived" || project.id === model.selectedProjectId),
    [model.projects, model.selectedProjectId],
  );

  useEffect(() => {
    const previous = previousLifecycleRef.current;
    const current = { id: model.schedule.project.id, status: model.schedule.project.status };
    previousLifecycleRef.current = current;
    if (previous.id !== current.id || previous.status === current.status) return undefined;
    let focusFrame = 0;
    const settleFrame = window.requestAnimationFrame(() => {
      focusFrame = window.requestAnimationFrame(() => {
        lifecycleActionRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
      });
    });
    return () => {
      window.cancelAnimationFrame(settleFrame);
      window.cancelAnimationFrame(focusFrame);
    };
  }, [model.schedule.project.id, model.schedule.project.status]);

  return <>
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
        supplementalSections={({ close }) => <section className="search-workspace-section planning-search-plan-actions" aria-label={t("planning.actions.label", "Plan actions")}>
          <h3><FolderKanban size={16} aria-hidden="true" /> {t("planning.actions.label", "Plan actions")}</h3>
          <div className="planning-search-plan-action-list">
            <WorkspaceActionButton action="create" labelKey="planning.projectCreate.action" fallbackLabel="New project" onClick={() => { close(); actions.onNewProject(); }} disabled={!model.canCreateProject || Boolean(model.busy)} />
            <WorkspaceActionButton action="create" labelKey="planning.noProject.sampleAction" fallbackLabel="New sample plan" onClick={() => { actions.onCreateDemoSchedule(); close(); }} loading={model.busy === "demo"} disabled={model.reviewMode} />
            <WorkspaceActionButton action="refresh" onClick={() => { actions.onRefresh(); close(); }} loading={model.busy === "refresh"} />
            <div ref={lifecycleActionRef} className="planning-project-lifecycle-action">
            {model.schedule.project.status === "archived" ? (
              <ConfirmCommandButton
                key={`${model.schedule.project.id}:${model.schedule.project.status}`}
                icon={RotateCcw}
                message={t("planning.projectLifecycle.restoreQuestion", "Restore {name} to active Planning work? A reason is recorded in the project revision and audit evidence.").replace("{name}", model.schedule.project.name)}
                dialogLabel={t("planning.projectLifecycle.restoreDialog", "Restore project {name}").replace("{name}", model.schedule.project.name)}
                title={t("planning.projectLifecycle.restore", "Restore project")}
                confirmLabel={t("planning.projectLifecycle.restore", "Restore project")}
                reasonLabel={t("planning.projectLifecycle.restoreReason", "Reason for restoring")}
                reasonPlaceholder={t("planning.projectLifecycle.restorePlaceholder", "Explain why Planning work is resuming")}
                reasonRequired
                onConfirm={async (reason) => {
                  await actions.onRestoreProject(reason || "");
                  close();
                }}
                disabled={!model.canTransitionProject || Boolean(model.busy)}
                loading={model.busy === "project-restore"}
              >
                {t("planning.projectLifecycle.restore", "Restore project")}
              </ConfirmCommandButton>
            ) : (
              <ConfirmCommandButton
                key={`${model.schedule.project.id}:${model.schedule.project.status}`}
                icon={Trash2}
                message={t("planning.projectLifecycle.deleteQuestion", "Delete {name}? UOK will archive this project. Its {tasks} tasks, {dependencies} dependencies, history, and evidence are not permanently erased and can be restored.")
                  .replace("{name}", model.schedule.project.name)
                  .replace("{tasks}", String(model.schedule.tasks.length))
                  .replace("{dependencies}", String(model.schedule.dependencies.length))}
                dialogLabel={t("planning.projectLifecycle.deleteDialog", "Delete project {name}").replace("{name}", model.schedule.project.name)}
                title={t("planning.projectLifecycle.delete", "Delete project")}
                confirmLabel={t("planning.projectLifecycle.delete", "Delete project")}
                reasonLabel={t("planning.projectLifecycle.deleteReason", "Reason for deleting")}
                reasonPlaceholder={t("planning.projectLifecycle.deletePlaceholder", "Explain why this project should be archived")}
                reasonRequired
                onConfirm={async (reason) => {
                  await actions.onDeleteProject(reason || "");
                  close();
                }}
                disabled={!model.canTransitionProject || Boolean(model.busy)}
                loading={model.busy === "project-delete"}
                destructive
              >
                {t("planning.projectLifecycle.delete", "Delete project")}
              </ConfirmCommandButton>
            )}
            </div>
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
      context={<section className="planning-project-context" aria-label="Project summary">
        <label className="planning-project-picker">
          <span>Project</span>
          <select value={model.selectedProjectId} onChange={(event) => actions.onProjectChange(event.target.value)}>
            {pickerProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
        <div className="planning-project-summary">
          <span className="planning-status-chip">{model.schedule.project.status || "No status"}</span>
          <span className="planning-command-summary">{model.visibleSchedule.tasks.length} visible of {model.schedule.tasks.length} tasks, {model.schedule.dependencies.length} dependencies</span>
        </div>
      </section>}
      view={<>
        <label className="planning-view-control">
          <LayoutPanelTop size={16} aria-hidden="true" />
          <span>{t("command.view", "View")}</span>
          <select aria-label={t("planning.view.label", "Planning view")} value={model.activeView} onChange={(event) => actions.onActiveViewChange(event.target.value as PlanningView)}>
            {planningViews.map((view) => <option key={view} value={view}>{t(planningViewMessageKeys[view], view)}</option>)}
          </select>
        </label>
        <PlanningScheduleHealth schedule={model.schedule} reviewMode={model.reviewMode} reviewModeLocked={model.reviewModeLocked} />
      </>}
      fields={<PlanningTimelineUtilities
        columnOptions={model.columnOptions} columnVisibility={model.columnVisibility} currentView={model.currentView}
        busy={model.busy} bulkUpdatesAvailable={model.bulkUpdatesAvailable} cascadeScheduling={model.cascadeScheduling} cascadeSort={model.cascadeSort}
        fieldPreset={model.fieldPreset}
        focusMode={model.focusMode} layoutMode={model.layoutMode} reviewMode={model.reviewMode} reviewModeLocked={model.reviewModeLocked}
        reportsOperational={model.reportsOperational} onApplySavedView={actions.onApplySavedView} onBulkTaskEdit={actions.onBulkTaskEdit}
        onCascadeSchedulingChange={() => actions.onCascadeSchedulingChange((value) => !value)} onCascadeSortChange={() => actions.onCascadeSortChange((value) => !value)}
        onCreateBaseline={actions.onCreateBaseline} onDateTarget={actions.onDateTarget} onFieldPresetChange={actions.onFieldPresetChange}
        onFitProject={actions.onFitProject} onLevelResources={actions.onLevelResources} onNewMilestone={() => actions.onNewTask("milestone")}
        onOpenDependencies={actions.onOpenDependencies} onShowInspector={actions.onShowInspector} onOpenResources={actions.onOpenResources} onScaleChange={actions.onScaleChange}
        onToggleBaselines={actions.onToggleBaselines} onToggleCritical={actions.onToggleCritical} onToggleColumn={actions.onToggleColumn}
        onToggleFocusMode={actions.onToggleFocusMode} onToggleLayoutMode={actions.onToggleLayoutMode} onToggleReviewMode={actions.onToggleReviewMode}
        onResetColumns={actions.onResetColumns} onSelectedTask={actions.onSelectedTask} onSelectedVisibleChange={actions.onSelectedVisibleChange}
        onSetCollapsedSummaries={actions.onSetCollapsedSummaries} onToday={actions.onToday} onViewDensityChange={actions.onViewDensityChange}
        projectStart={model.schedule.project.start} scale={model.scale} schedule={model.visibleSchedule} selectedCount={model.selectedCount}
        selectedTaskId={model.selectedTaskId} selectedTasks={model.selectedTasks} selectedVisible={model.selectedVisible}
        showBaselines={model.showBaselines} showCritical={model.showCritical} token={model.token} viewDensity={model.viewDensity}
      />}
      primaryAction={<WorkspaceActionButton action="create" labelKey="command.newTask" fallbackLabel="New task" onClick={() => actions.onNewTask("task")} disabled={model.reviewMode} primary />}
    />
  </>;
}

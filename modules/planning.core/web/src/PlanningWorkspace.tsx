import { FolderKanban, FolderPlus, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { EmptyState } from "@uok/shared/data-display";
import { Pane, WorkflowHeader } from "@uok/shared/layout";
import { useUokLocalization } from "@uok/shared/localization";
import { WorkspaceEditorPopup } from "@uok/shared/overlays";
import { CommandButton } from "@uok/shared/primitives";
import { PlanningConcurrencyNotice } from "./PlanningConcurrencyNotice";
import { PlanningErrorNotice } from "./PlanningErrorNotice";
import { PlanningInspector, type PlanningInspectorTab } from "./PlanningInspector";
import { PlanningModuleState } from "./PlanningModuleState";
import { PlanningPortfolioView } from "./PlanningPortfolioView";
import { PlanningProjectCreateDialog } from "./PlanningProjectCreateDialog";
import { PlanningProjectReloadNotice, planningProjectReloadFailure } from "./PlanningProjectReloadNotice";
import { PlanningTimeline } from "./PlanningTimeline";
import type { TimelineScale } from "./planningGanttModel";
import { timelineTaskPayload } from "./planningTimelineCreateModel";
import type { PlanningProject, PlanningSchedule, PlanningWorkspaceProps } from "./types";
import { usePlanningWorkspaceMutations } from "./usePlanningWorkspaceMutations";
import { usePlanningCapabilities } from "./usePlanningCapabilities";

export function PlanningWorkspace({ token, appearance, module, moduleRows, busyAction, onActivate }: PlanningWorkspaceProps) {
  const { t } = useUokLocalization();
  const [projects, setProjects] = useState<PlanningProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [schedule, setSchedule] = useState<PlanningSchedule | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [inspectorTab, setInspectorTab] = useState<PlanningInspectorTab>("task");
  const [newTaskType, setNewTaskType] = useState<"task" | "milestone">("task");
  const [timelineScale, setTimelineScale] = useState<TimelineScale>("day");
  const [showCritical, setShowCritical] = useState(true);
  const [showBaselines, setShowBaselines] = useState(true);
  const [reviewMode, setReviewMode] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<"project" | "portfolio">("project");
  const [projectCreateOpen, setProjectCreateOpen] = useState(false);
  const planningWorkspaceRef = useRef<HTMLElement>(null);
  const focusAfterCreateRef = useRef(false);
  const operational = module?.status === "installed" || module?.status === "upgraded";
  const reportsOperational = moduleRows.some(
    (row) => row.name === "reports.core" && (row.status === "installed" || row.status === "upgraded"),
  );
  const capabilities = usePlanningCapabilities(token, operational);
  const archivedReviewOnly = schedule?.project.status === "archived";
  const serverReviewOnly = capabilities.review_only || archivedReviewOnly || (schedule ? schedule.capabilities?.edit !== true : false);
  const actions = usePlanningWorkspaceMutations({
    token,
    operational,
    schedule,
    selectedProjectId,
    setProjects,
    setSchedule,
    setSelectedProjectId,
    setSelectedTaskId,
  });
  const createdReloadFailure = planningProjectReloadFailure(actions.status);
  const canCreateProject = capabilities.edit && !reviewMode && !actions.busy && !createdReloadFailure;
  const selectedTask = useMemo(
    () => schedule?.tasks.find((task) => task.id === selectedTaskId) || null,
    [schedule, selectedTaskId],
  );

  useEffect(() => {
    if (projectCreateOpen || !focusAfterCreateRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      focusAfterCreateRef.current = false;
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body && active !== document.documentElement && active.isConnected) return;
      const picker = planningWorkspaceRef.current?.querySelector<HTMLSelectElement>(".planning-project-picker select");
      (picker || planningWorkspaceRef.current)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [projectCreateOpen, schedule?.project.id, workspaceMode]);

  if (!token) return <EmptyState text="Sign in to open Planning." />;
  if (!operational) return <PlanningModuleState module={module} moduleRows={moduleRows} busyAction={busyAction} onActivate={onActivate} />;

  return (
    <section className="planning-workspace" aria-label="Planning" ref={planningWorkspaceRef} tabIndex={-1}>
      <PlanningErrorNotice status={actions.status} />
      <nav className="planning-scope-switch" aria-label={t("planning.scope", "Planning scope")}>
        <button type="button" aria-current={workspaceMode === "project" ? "page" : undefined} onClick={() => setWorkspaceMode("project")}>{t("planning.projectSchedule", "Project schedule")}</button>
        <button type="button" aria-current={workspaceMode === "portfolio" ? "page" : undefined} onClick={() => {
          setInspectorOpen(false);
          setWorkspaceMode("portfolio");
        }}>{t("planning.portfolio", "Portfolio")}</button>
      </nav>
      <PlanningProjectReloadNotice status={actions.status} busy={actions.busy} onRetry={() => void actions.refresh()} />
      {workspaceMode === "portfolio" ? (
        <PlanningPortfolioView
          token={token}
          canCreateProject={Boolean(canCreateProject)}
          creatingProject={actions.busy === "project-create"}
          onNewProject={() => setProjectCreateOpen(true)}
          onOpenProject={(projectId) => {
            setWorkspaceMode("project");
            void actions.changeProject(projectId);
          }}
        />
      ) : !schedule ? (
        <>
          <WorkflowHeader
            eyebrow={t("planning.portfolio.eyebrow", "Planning")}
            title={t("planning.projectSchedule", "Project schedule")}
            summary={t("planning.noProject.summary", "Create a project or use a sample plan to begin.")}
          >
            {!createdReloadFailure ? <>
              <CommandButton icon={FolderPlus} onClick={() => setProjectCreateOpen(true)} loading={actions.busy === "project-create"} disabled={!canCreateProject} primary>
                {t("planning.projectCreate.action", "New project")}
              </CommandButton>
              <CommandButton icon={FolderKanban} onClick={() => void actions.createDemoSchedule()} loading={actions.busy === "demo"} disabled={!capabilities.edit || reviewMode || Boolean(actions.busy)}>
                {t("planning.noProject.sampleAction", "New sample plan")}
              </CommandButton>
              <CommandButton icon={RefreshCw} onClick={() => void actions.refresh()} loading={actions.busy === "refresh"} disabled={Boolean(actions.busy)}>
                {t("account.refresh", "Refresh")}
              </CommandButton>
            </> : null}
          </WorkflowHeader>
          <Pane title={t("planning.noProject.title", "No projects")} description={t("planning.projectSchedule", "Planning workspace")} wide>
            <EmptyState text={t("planning.noProject.empty", "Create a project to open its validated schedule, or use a sample plan for evaluation.")} />
          </Pane>
        </>
      ) : (
        <>
          {serverReviewOnly ? <span className="planning-capability-notice" role="status">{archivedReviewOnly
            ? t("planning.review.archived", "Archived project is read-only; restore it to active before editing.")
            : t("planning.review.permissions", "Server permissions allow review only; write controls are disabled.")}</span> : null}
          {actions.staleRecovery ? (
            <PlanningConcurrencyNotice
              recovery={actions.staleRecovery}
              busy={actions.busy}
              onReapply={() => void actions.reapplyStaleMutation()}
              onKeepLatest={actions.keepLatestSchedule}
              onReload={() => void actions.reloadStaleSchedule()}
            />
          ) : null}
          <section className="workflow-primary-region" aria-label={t("planning.timelineRegion", "Planning timeline")}>
            {renderPlanningPrimaryPane(schedule)}
          </section>
          {renderPlanningInspectorPopup(schedule)}
        </>
      )}
      <PlanningProjectCreateDialog
        open={projectCreateOpen}
        busy={Boolean(actions.busy)}
        onClose={() => {
          focusAfterCreateRef.current = true;
          setProjectCreateOpen(false);
        }}
        onCreate={async (payload) => {
          await actions.createProject(payload);
          setWorkspaceMode("project");
        }}
      />
    </section>
  );

  function renderPlanningPrimaryPane(activeSchedule: PlanningSchedule) {
    return (
      <div className="planning-primary-stack">
        <PlanningTimeline
          projects={projects}
          schedule={activeSchedule}
          appearance={appearance}
          scale={timelineScale}
          showCritical={showCritical}
          showBaselines={showBaselines}
          reviewMode={reviewMode || serverReviewOnly}
          reviewModeLocked={serverReviewOnly}
          reportsOperational={reportsOperational}
          selectedTaskId={selectedTaskId}
          selectedProjectId={selectedProjectId}
          busy={actions.busy}
          history={actions.history}
          bulkUpdatesAvailable={actions.bulkUpdatesAvailable}
          onScaleChange={setTimelineScale}
          onToggleCritical={() => setShowCritical((value) => !value)}
          onToggleBaselines={() => setShowBaselines((value) => !value)}
          onReviewModeChange={setReviewMode}
          onTaskSelect={setSelectedTaskId}
          onTaskOpen={(taskId) => {
            setSelectedTaskId(taskId);
            setInspectorTab("task");
            setInspectorOpen(true);
          }}
          onTaskReschedule={actions.rescheduleTask}
          onTaskProgress={(taskId, progress) => void actions.saveTask(taskId, { progress })}
          onTaskInlineEdit={(taskId, payload, cascade) => void actions.saveTask(taskId, payload, cascade)}
          onBulkTaskEdit={(updates) => void actions.saveTaskBatch(updates)}
          onDependencyCreate={(payload) => void actions.addDependency(payload)}
          onTimelineTaskCreate={(start, end) => void actions.addTask(timelineTaskPayload(activeSchedule.tasks, start, end))}
          onTaskMenuAction={(action, task) => void actions.runTaskMenuAction(action, task)}
          onProjectChange={(projectId) => void actions.changeProject(projectId)}
          canCreateProject={Boolean(canCreateProject)}
          onNewProject={() => setProjectCreateOpen(true)}
          onCreateDemoSchedule={() => void actions.createDemoSchedule()}
          onRefresh={() => void actions.refresh()}
          onNewTask={(taskType) => {
            setNewTaskType(taskType);
            setSelectedTaskId("");
            setInspectorTab("task");
            setInspectorOpen(true);
          }}
          onOpenDependencies={() => {
            setInspectorTab("dependencies");
            setInspectorOpen(true);
          }}
          onShowInspector={() => setInspectorOpen(true)}
          onCreateBaseline={() => void actions.addBaseline({ name: `Baseline ${activeSchedule.baselines.length + 1}` })}
          onOpenResources={() => {
            setInspectorTab("resources");
            setInspectorOpen(true);
          }}
          onLevelResources={(horizonDays) => void actions.levelResources(horizonDays)}
          onUndo={() => void actions.runHistory("undo")}
          onRedo={() => void actions.runHistory("redo")}
          token={token}
        />
      </div>
    );
  }

  function renderPlanningInspectorPopup(activeSchedule: PlanningSchedule) {
    return (
      <WorkspaceEditorPopup
        open={inspectorOpen}
        label={t("planning.inspector.dialogLabel", "Planning inspector")}
        title={t("planning.inspector.title", "Inspector")}
        description={activeSchedule.project.name}
        onClose={() => setInspectorOpen(false)}
        size="wide"
        chrome="minimal"
        className="planning-inspector-popup"
        dismissible={!Boolean(actions.busy)}
      >
        <PlanningInspector
          token={token}
          projects={projects}
          schedule={activeSchedule}
          selectedTask={selectedTask}
          activeTab={inspectorTab}
          newTaskType={newTaskType}
          status={actions.status}
          busy={actions.busy}
          readOnly={reviewMode || serverReviewOnly}
          linkReadOnly={reviewMode || !capabilities.link || activeSchedule.capabilities?.link !== true}
          canApproveGates={capabilities.gate_approve && activeSchedule.capabilities?.gate_approve === true}
          canAnalyze={capabilities.analyze && activeSchedule.capabilities?.analyze === true}
          canApproveAnalysis={capabilities.analysis_approve && activeSchedule.capabilities?.analysis_approve === true}
          onTabChange={setInspectorTab}
          onProjectChange={actions.changeProject}
          onSaveTask={actions.saveTask}
          onSaveTaskDates={actions.saveTaskDates}
          onCreateTask={actions.addTask}
          onDeleteTask={actions.removeTask}
          onCreateDependency={actions.addDependency}
          onUpdateDependency={actions.saveDependency}
          onRemoveDependency={actions.removeDependency}
          onCreatePlanningLink={actions.addPlanningLink}
          onRemovePlanningLink={actions.removePlanningLink}
          onAddTaskParticipant={actions.addTaskParticipant}
          onRemoveTaskParticipant={actions.removeTaskParticipant}
          onCreateTaskRequirement={actions.addTaskRequirement}
          onAdvanceTaskRequirement={actions.advanceTaskRequirement}
          onSetTaskRequirementLink={actions.setTaskRequirementLink}
          onDecideTaskRequirement={actions.decideTaskRequirement}
          onSetCalendar={actions.saveCalendar}
          onCreateBaseline={actions.addBaseline}
          onCreateResource={actions.addResource}
          onAssignResource={actions.assignResource}
          onSetResourceCalendar={actions.saveResourceCalendar}
          onCreateWhatIfSnapshot={actions.createWhatIfSnapshot}
          onRunRiskAnalysis={actions.runRiskAnalysis}
          onRunOptimization={actions.runOptimization}
          onDecideRecommendation={actions.decideRecommendation}
          onApplyRecommendation={actions.applyRecommendation}
          onRollbackRecommendation={actions.rollbackRecommendation}
        />
      </WorkspaceEditorPopup>
    );
  }
}

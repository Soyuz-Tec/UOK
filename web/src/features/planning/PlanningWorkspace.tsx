import { FolderKanban, PanelRightClose, PanelRightOpen, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "../../shared/data-display";
import { Pane, WorkflowHeader, WorkflowSplitView } from "../../shared/layout";
import { CommandButton } from "../../shared/primitives";
import { PlanningConcurrencyNotice } from "./PlanningConcurrencyNotice";
import { PlanningErrorNotice } from "./PlanningErrorNotice";
import { PlanningInspector, type PlanningInspectorTab } from "./PlanningInspector";
import { PlanningModuleState } from "./PlanningModuleState";
import { PlanningTimeline } from "./PlanningTimeline";
import type { TimelineScale } from "./planningGanttModel";
import { timelineTaskPayload } from "./planningTimelineCreateModel";
import type { PlanningProject, PlanningSchedule, PlanningWorkspaceProps } from "./types";
import { usePlanningWorkspaceMutations } from "./usePlanningWorkspaceMutations";
import { usePlanningCapabilities } from "./usePlanningCapabilities";

export function PlanningWorkspace({ token, appearance, module, moduleRows, busyAction, onActivate }: PlanningWorkspaceProps) {
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
  const operational = module?.status === "installed" || module?.status === "upgraded";
  const capabilities = usePlanningCapabilities(token, operational);
  const serverReviewOnly = capabilities.review_only || (schedule ? schedule.capabilities?.edit !== true : false);
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
  const selectedTask = useMemo(
    () => schedule?.tasks.find((task) => task.id === selectedTaskId) || null,
    [schedule, selectedTaskId],
  );

  if (!token) return <EmptyState text="Sign in to open Planning." />;
  if (!operational) return <PlanningModuleState module={module} moduleRows={moduleRows} busyAction={busyAction} onActivate={onActivate} />;

  return (
    <section className="planning-workspace" aria-label="Planning">
      <PlanningErrorNotice status={actions.status} />
      {!schedule ? (
        <>
          <WorkflowHeader
            eyebrow="Planning"
            title="Project schedule"
            summary="Create a plan to begin."
          >
            <>
              <CommandButton icon={FolderKanban} onClick={() => void actions.createDemoSchedule()} loading={actions.busy === "demo"} disabled={!capabilities.edit} primary>
                New sample plan
              </CommandButton>
              <CommandButton icon={RefreshCw} onClick={() => void actions.refresh()} loading={actions.busy === "refresh"}>
                Refresh
              </CommandButton>
            </>
          </WorkflowHeader>
          <Pane title="No plans" description="Planning workspace" wide>
            <EmptyState text="Create a sample plan to load the validated Gantt read model." />
          </Pane>
        </>
      ) : (
        <>
          {serverReviewOnly ? <span className="planning-capability-notice" role="status">Server permissions allow review only; write controls are disabled.</span> : null}
          {actions.staleRecovery ? (
            <PlanningConcurrencyNotice
              recovery={actions.staleRecovery}
              busy={actions.busy}
              onReapply={() => void actions.reapplyStaleMutation()}
              onKeepLatest={actions.keepLatestSchedule}
              onReload={() => void actions.reloadStaleSchedule()}
            />
          ) : null}
          <WorkflowSplitView
            primaryLabel="Planning timeline"
            secondaryLabel="Planning inspector"
            primary={renderPlanningPrimaryPane(schedule)}
            secondary={renderPlanningInspectorPane(schedule)}
            secondaryOpen={inspectorOpen}
            secondaryPresentation="slide"
          />
        </>
      )}
    </section>
  );

  function renderPlanningPrimaryPane(activeSchedule: PlanningSchedule) {
    return (
      <div className="planning-primary-stack">
        {!inspectorOpen ? (
          <div className="planning-inspector-toggle-row planning-inspector-toggle-floating">
            <CommandButton icon={PanelRightOpen} onClick={() => setInspectorOpen(true)}>Show inspector</CommandButton>
          </div>
        ) : null}
        <PlanningTimeline
          projects={projects}
          schedule={activeSchedule}
          appearance={appearance}
          scale={timelineScale}
          showCritical={showCritical}
          showBaselines={showBaselines}
          reviewMode={reviewMode || serverReviewOnly}
          selectedTaskId={selectedTaskId}
          selectedProjectId={selectedProjectId}
          busy={actions.busy}
          history={actions.history}
          bulkUpdatesAvailable={actions.bulkUpdatesAvailable}
          onScaleChange={setTimelineScale}
          onToggleCritical={() => setShowCritical((value) => !value)}
          onToggleBaselines={() => setShowBaselines((value) => !value)}
          onReviewModeChange={setReviewMode}
          onTaskSelect={(taskId) => {
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
          onCreateBaseline={() => void actions.addBaseline({ name: `Baseline ${activeSchedule.baselines.length + 1}` })}
          onOpenResources={() => {
            setInspectorTab("resources");
            setInspectorOpen(true);
          }}
          onLevelResources={() => void actions.levelResources()}
          onUndo={() => void actions.runHistory("undo")}
          onRedo={() => void actions.runHistory("redo")}
          token={token}
        />
      </div>
    );
  }

  function renderPlanningInspectorPane(activeSchedule: PlanningSchedule) {
    return (
      <div className="planning-inspector-stack">
        <div className="planning-inspector-toggle-row">
          <CommandButton icon={PanelRightClose} onClick={() => setInspectorOpen(false)}>Hide inspector</CommandButton>
        </div>
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
        />
      </div>
    );
  }
}

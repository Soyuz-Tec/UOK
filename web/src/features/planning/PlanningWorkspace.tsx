import { FolderKanban, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "../../shared/data-display";
import { Pane, WorkflowHeader, WorkflowSplitView } from "../../shared/layout";
import { CommandButton } from "../../shared/primitives";
import { PlanningInspector, type PlanningInspectorTab } from "./PlanningInspector";
import { PlanningModuleState } from "./PlanningModuleState";
import { PlanningTimeline } from "./PlanningTimeline";
import type { TimelineScale } from "./planningGanttModel";
import { timelineTaskPayload } from "./planningTimelineCreateModel";
import type { PlanningProject, PlanningSchedule, PlanningWorkspaceProps } from "./types";
import { usePlanningWorkspaceMutations } from "./usePlanningWorkspaceMutations";

export function PlanningWorkspace({ token, appearance, module, busyAction, onActivate }: PlanningWorkspaceProps) {
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
  const operational = module?.status === "installed" || module?.status === "upgraded";
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
  if (!operational) return <PlanningModuleState module={module} busyAction={busyAction} onActivate={onActivate} />;

  return (
    <section className="planning-workspace" aria-label="Planning">
      {!schedule ? (
        <>
          <WorkflowHeader
            eyebrow="Planning"
            title="Project schedule"
            summary="Create a plan to begin."
          >
            <>
              <CommandButton icon={FolderKanban} onClick={() => void actions.createDemoSchedule()} loading={actions.busy === "demo"} primary>
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
        <WorkflowSplitView
          primaryLabel="Planning timeline"
          secondaryLabel="Planning inspector"
          primary={(
            <PlanningTimeline
              projects={projects}
              schedule={schedule}
              appearance={appearance}
              scale={timelineScale}
              showCritical={showCritical}
              showBaselines={showBaselines}
              reviewMode={reviewMode}
              selectedTaskId={selectedTaskId}
              selectedProjectId={selectedProjectId}
              busy={actions.busy}
              history={actions.history}
              onScaleChange={setTimelineScale}
              onToggleCritical={() => setShowCritical((value) => !value)}
              onToggleBaselines={() => setShowBaselines((value) => !value)}
              onReviewModeChange={setReviewMode}
              onTaskSelect={(taskId) => {
                setSelectedTaskId(taskId);
                setInspectorTab("task");
              }}
              onTaskReschedule={actions.rescheduleTask}
              onTaskProgress={(taskId, progress) => void actions.saveTask(taskId, { progress })}
              onTaskInlineEdit={(taskId, payload, cascade) => void actions.saveTask(taskId, payload, cascade)}
              onBulkTaskEdit={(updates) => void actions.saveTaskBatch(updates)}
              onDependencyCreate={(payload) => void actions.addDependency(payload)}
              onTimelineTaskCreate={(start, end) => void actions.addTask(timelineTaskPayload(schedule.tasks, start, end))}
              onTaskMenuAction={(action, task) => void actions.runTaskMenuAction(action, task)}
              onProjectChange={(projectId) => void actions.changeProject(projectId)}
              onCreateDemoSchedule={() => void actions.createDemoSchedule()}
              onRefresh={() => void actions.refresh()}
              onNewTask={(taskType) => {
                setNewTaskType(taskType);
                setSelectedTaskId("");
                setInspectorTab("task");
              }}
              onOpenDependencies={() => setInspectorTab("links")}
              onCreateBaseline={() => void actions.addBaseline({ name: `Baseline ${schedule.baselines.length + 1}` })}
              onOpenResources={() => setInspectorTab("resources")}
              onLevelResources={() => void actions.levelResources()}
              onUndo={() => void actions.runHistory("undo")}
              onRedo={() => void actions.runHistory("redo")}
              token={token}
            />
          )}
          secondary={(
            <PlanningInspector
              projects={projects}
              schedule={schedule}
              selectedTask={selectedTask}
              activeTab={inspectorTab}
              newTaskType={newTaskType}
              status={actions.status}
              busy={actions.busy}
              readOnly={reviewMode}
              onTabChange={setInspectorTab}
              onProjectChange={actions.changeProject}
              onSaveTask={actions.saveTask}
              onCreateTask={actions.addTask}
              onDeleteTask={actions.removeTask}
              onCreateDependency={actions.addDependency}
              onUpdateDependency={actions.saveDependency}
              onRemoveDependency={actions.removeDependency}
              onSetCalendar={actions.saveCalendar}
              onCreateBaseline={actions.addBaseline}
              onCreateResource={actions.addResource}
              onAssignResource={actions.assignResource}
            />
          )}
        />
      )}
    </section>
  );
}

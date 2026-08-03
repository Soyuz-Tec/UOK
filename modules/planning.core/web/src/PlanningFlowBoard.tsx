import { useId, useRef, useState } from "react";
import type { DragEvent as ReactDragEvent } from "react";

import { useUokLocalization } from "@uok/shared/localization";

import { PlanningFlowCard } from "./PlanningFlowCard";
import { localizedPlanningStatusLabel, planningFlowDropTarget, planningFlowLanes } from "./planningFlowBoardModel";
import type { PlanningTaskUpdateRequest } from "./planningContracts";
import type { PlanningSchedule, PlanningTask, PlanningTaskStatus } from "./types";
import { usePlanningFlowFocus } from "./usePlanningFlowFocus";

type PendingMove = { taskId: string };
type DragState = { taskId: string; hoveredStatus?: PlanningTaskStatus };

export function PlanningFlowBoard({
  busy,
  readOnly,
  schedule,
  onTaskOpen,
  onTaskUpdate,
}: {
  busy: boolean;
  readOnly: boolean;
  schedule: PlanningSchedule;
  onTaskOpen: (taskId: string) => void;
  onTaskUpdate: (taskId: string, payload: PlanningTaskUpdateRequest) => Promise<boolean> | boolean;
}) {
  const { formatDate, formatNumber, t } = useUokLocalization();
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const openControlRefs = useRef(new Map<string, HTMLButtonElement>());
  const {
    activeDragTaskId, cancelDeferredFocus, clearReconciledFocus, deferTaskFocus,
    deferredFocusTaskId, expectReconciledFocus, restoreTaskFocus,
  } = usePlanningFlowFocus(schedule.project.revision, boardRef, openControlRefs);
  const pendingMoveTaskId = useRef<string | null>(null);
  const instructionsId = useId();
  const [announcement, setAnnouncement] = useState("");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const lanes = planningFlowLanes(schedule);

  if (!schedule.task_flow) {
    return (
      <div className="planning-read-view planning-flow-unavailable" role="alert">
        {t("planning.board.unavailable", "Task flow is unavailable. Refresh the validated schedule.")}
      </div>
    );
  }

  return (
    <div
      ref={boardRef}
      className="planning-read-view planning-board-view"
      role="region"
      aria-describedby={instructionsId}
      aria-label={t("planning.board.label", "Planning flow board")}
      tabIndex={-1}
    >
      <p id={instructionsId} className="visually-hidden">
        {readOnly
          ? t("planning.board.instructionsReview", "Select a task card to inspect it. Editing and moving are unavailable in review mode.")
          : t("planning.board.instructionsEdit", "Drag a card to an allowed stage. Select the card to open it; select its title to edit. More actions offers an accessible move.")}
      </p>
      <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
      {lanes.map((lane) => {
        const count = lane.tasks.length;
        const laneLabel = localizedPlanningStatusLabel(schedule, lane.status, t);
        const countLabel = `${formatNumber(count)} ${t(count === 1 ? "planning.board.task.one" : "planning.board.task.many", count === 1 ? "task" : "tasks")}`;
        const dropState = dragState?.hoveredStatus === lane.status
          ? planningFlowDropTarget(schedule, dragState.taskId, lane.status) ? "allowed" : "invalid"
          : undefined;
        return (
          <section
            key={lane.status}
            className="planning-read-lane"
            data-flow-drop-state={dropState}
            data-planning-status={lane.status}
            role="region"
            aria-label={`${laneLabel}, ${countLabel}`}
            onDragEnter={() => hoverDrag(lane.status)}
            onDragLeave={(event) => leaveLane(event, lane.status)}
            onDragOver={(event) => dragOverLane(event, lane.status)}
            onDrop={(event) => dropIntoLane(event, lane.status)}
          >
            <header className="planning-read-lane-header">
              <h3>{laneLabel}</h3>
              <span aria-hidden="true">{formatNumber(count)}</span>
            </header>
            <div className="planning-read-lane-tasks">
              {lane.tasks.map((task) => (
                <PlanningFlowCard
                  key={task.id}
                  busy={busy}
                  dragging={dragState?.taskId === task.id}
                  formatDate={formatDate}
                  formatNumber={formatNumber}
                  pending={pendingMove?.taskId === task.id}
                  readOnly={readOnly}
                  schedule={schedule}
                  task={task}
                  registerOpenControl={(control) => registerOpenControl(task.id, control)}
                  t={t}
                  onDragBegin={() => beginDrag(task)}
                  onDragFinish={() => finishDrag(task)}
                  onMove={(status) => { void moveTask(task.id, status, false); }}
                  onOpen={() => onTaskOpen(task.id)}
                  onTitleChange={(title) => updateTitle(task.id, title)}
                />
              ))}
              {!count ? <p className="planning-read-lane-empty">{t("planning.board.emptyLane", "No tasks")}</p> : null}
            </div>
          </section>
        );
      })}
    </div>
  );

  function registerOpenControl(taskId: string, control: HTMLButtonElement | null) {
    if (control) openControlRefs.current.set(taskId, control);
    else openControlRefs.current.delete(taskId);
  }

  function beginDrag(task: PlanningTask) {
    if (busy || readOnly || pendingMoveTaskId.current) return;
    const next = { taskId: task.id };
    cancelDeferredFocus();
    activeDragTaskId.current = task.id;
    dragRef.current = next;
    setDragState(next);
    setAnnouncement(template(t("planning.board.dragging", "Dragging {task}. Choose an allowed stage."), { task: task.title }));
  }

  function hoverDrag(status: PlanningTaskStatus) {
    const current = dragRef.current;
    if (!current || current.hoveredStatus === status) return;
    const next = { ...current, hoveredStatus: status };
    dragRef.current = next;
    setDragState(next);
  }

  function leaveLane(event: ReactDragEvent<HTMLElement>, status: PlanningTaskStatus) {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    const current = dragRef.current;
    if (!current || current.hoveredStatus !== status) return;
    const next = { taskId: current.taskId };
    dragRef.current = next;
    setDragState(next);
  }

  function dragOverLane(event: ReactDragEvent<HTMLElement>, status: PlanningTaskStatus) {
    const current = dragRef.current;
    if (!current) return;
    event.preventDefault();
    hoverDrag(status);
    event.dataTransfer.dropEffect = planningFlowDropTarget(schedule, current.taskId, status) ? "move" : "none";
  }

  function dropIntoLane(event: ReactDragEvent<HTMLElement>, status: PlanningTaskStatus) {
    const current = dragRef.current;
    if (!current) return;
    event.preventDefault();
    const accepted = planningFlowDropTarget(schedule, current.taskId, status);
    clearDrag();
    if (accepted) {
      void moveTask(current.taskId, status, true);
      return;
    }
    const task = schedule.tasks.find((item) => item.id === current.taskId);
    if (!task) return;
    setAnnouncement(template(t("planning.board.dropNotAllowed", "{task} cannot move to {status}."), {
      task: task.title,
      status: localizedPlanningStatusLabel(schedule, status, t),
    }));
  }

  function finishDrag(task: PlanningTask) {
    if (activeDragTaskId.current === task.id) {
      activeDragTaskId.current = null;
      if (deferredFocusTaskId.current === task.id) {
        cancelDeferredFocus();
        restoreTaskFocus(task.id);
      }
    }
    if (dragRef.current?.taskId !== task.id) return;
    clearDrag();
    setAnnouncement(template(t("planning.board.dragCancelled", "Drag canceled for {task}."), { task: task.title }));
  }

  function clearDrag() {
    dragRef.current = null;
    setDragState(null);
  }

  async function moveTask(taskId: string, targetStatus: PlanningTaskStatus, fromDrag: boolean) {
    const task = schedule.tasks.find((item) => item.id === taskId);
    if (!task || readOnly || busy || pendingMoveTaskId.current) return;
    if (!planningFlowDropTarget(schedule, taskId, targetStatus)) return;
    cancelDeferredFocus();
    if (!fromDrag) activeDragTaskId.current = null;
    const statusLabel = localizedPlanningStatusLabel(schedule, targetStatus, t);
    pendingMoveTaskId.current = task.id;
    expectReconciledFocus(task.id, schedule.project.revision);
    setPendingMove({ taskId: task.id });
    setAnnouncement(template(t("planning.board.moving", "Moving {task} to {status}."), { task: task.title, status: statusLabel }));
    try {
      const applied = await onTaskUpdate(task.id, { status: targetStatus });
      if (!applied) throw new Error("Task move was not accepted");
      setAnnouncement(template(t("planning.board.moveSuccess", "{task} moved to {status}."), { task: task.title, status: statusLabel }));
    } catch {
      clearReconciledFocus();
      setAnnouncement(t("planning.board.moveNotApplied", "Task move was not applied. Review the Planning notice."));
    } finally {
      pendingMoveTaskId.current = null;
      setPendingMove(null);
      if (fromDrag && activeDragTaskId.current === task.id) deferTaskFocus(task.id);
      else restoreTaskFocus(task.id);
    }
  }

  async function updateTitle(taskId: string, title: string) {
    const task = schedule.tasks.find((item) => item.id === taskId);
    if (!task || readOnly || busy) return false;
    setAnnouncement(template(t("planning.board.titleSaving", "Saving the new title for {task}."), { task: task.title }));
    try {
      const applied = await onTaskUpdate(task.id, { title });
      if (!applied) throw new Error("Task title was not accepted");
      setAnnouncement(template(t("planning.board.titleSuccess", "Task title updated to {task}."), { task: title }));
      return true;
    } catch {
      setAnnouncement(t("planning.board.titleNotApplied", "Task title was not updated. Review the Planning notice."));
      return false;
    }
  }
}

function template(value: string, replacements: Record<string, string>) {
  return Object.entries(replacements).reduce((result, [key, replacement]) => result.replaceAll(`{${key}}`, replacement), value);
}

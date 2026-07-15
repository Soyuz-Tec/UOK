import { useEffect, useRef, useState } from "react";

import { WorkspaceActionButton } from "@uok/shared/actions";
import { useUokLocalization } from "@uok/shared/localization";

import { planningFlowLanes, planningFlowTargets } from "./planningFlowBoardModel";
import type { PlanningSchedule, PlanningTask, PlanningTaskStatus } from "./types";

type PendingMove = {
  taskId: string;
};

export function PlanningFlowBoard({
  busy,
  readOnly,
  schedule,
  onTaskOpen,
  onTaskStatusChange,
}: {
  busy: boolean;
  readOnly: boolean;
  schedule: PlanningSchedule;
  onTaskOpen: (taskId: string) => void;
  onTaskStatusChange: (taskId: string, status: PlanningTaskStatus) => Promise<boolean> | boolean;
}) {
  const { formatDate, formatNumber, t } = useUokLocalization();
  const boardRef = useRef<HTMLDivElement>(null);
  const moveControlRefs = useRef(new Map<string, HTMLSelectElement>());
  const pendingFocusTaskId = useRef<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const lanes = planningFlowLanes(schedule);

  useEffect(() => {
    if (pendingMove || !pendingFocusTaskId.current) return;
    const taskId = pendingFocusTaskId.current;
    const frame = window.requestAnimationFrame(() => {
      pendingFocusTaskId.current = null;
      const control = moveControlRefs.current.get(taskId);
      if (control?.isConnected) control.focus();
      else boardRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pendingMove, schedule.tasks]);

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
      aria-label={t("planning.board.label", "Planning flow board")}
      tabIndex={-1}
    >
      <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
      {lanes.map((lane) => {
        const count = lane.tasks.length;
        const laneLabel = localizedStatusLabel(schedule, lane.status, t);
        const countLabel = `${formatNumber(count)} ${t(count === 1 ? "planning.board.task.one" : "planning.board.task.many", count === 1 ? "task" : "tasks")}`;
        return (
          <section
            key={lane.status}
            className="planning-read-lane"
            data-planning-status={lane.status}
            role="region"
            aria-label={`${laneLabel}, ${countLabel}`}
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
                  formatDate={formatDate}
                  formatNumber={formatNumber}
                  pending={pendingMove?.taskId === task.id}
                  readOnly={readOnly}
                  schedule={schedule}
                  task={task}
                  registerMoveControl={(control) => {
                    if (control) moveControlRefs.current.set(task.id, control);
                    else moveControlRefs.current.delete(task.id);
                  }}
                  t={t}
                  onMove={(status) => moveTask(task, status)}
                  onOpen={() => onTaskOpen(task.id)}
                />
              ))}
              {!count ? <p className="planning-read-lane-empty">{t("planning.board.emptyLane", "No tasks")}</p> : null}
            </div>
          </section>
        );
      })}
    </div>
  );

  async function moveTask(task: PlanningTask, targetStatus: PlanningTaskStatus) {
    if (readOnly || busy) return;
    const target = planningFlowTargets(schedule, task).find((item) => item.status === targetStatus);
    if (!target) return;
    const statusLabel = localizedStatusLabel(schedule, targetStatus, t);
    setPendingMove({ taskId: task.id });
    setAnnouncement(template(
      t("planning.board.moving", "Moving {task} to {status}."),
      { task: task.title, status: statusLabel },
    ));
    try {
      const applied = await onTaskStatusChange(task.id, targetStatus);
      if (!applied) throw new Error("Task move was not accepted");
      setAnnouncement(template(
        t("planning.board.moveSuccess", "{task} moved to {status}."),
        { task: task.title, status: statusLabel },
      ));
    } catch {
      setAnnouncement(t("planning.board.moveNotApplied", "Task move was not applied. Review the Planning notice."));
    } finally {
      pendingFocusTaskId.current = task.id;
      setPendingMove(null);
    }
  }
}

function PlanningFlowCard({
  busy,
  formatDate,
  formatNumber,
  pending,
  readOnly,
  registerMoveControl,
  schedule,
  task,
  t,
  onMove,
  onOpen,
}: {
  busy: boolean;
  formatDate: (value: Date | string) => string;
  formatNumber: (value: number) => string;
  pending: boolean;
  readOnly: boolean;
  registerMoveControl: (control: HTMLSelectElement | null) => void;
  schedule: PlanningSchedule;
  task: PlanningTask;
  t: (key: string, fallback?: string) => string;
  onMove: (status: PlanningTaskStatus) => void;
  onOpen: () => void;
}) {
  const targets = planningFlowTargets(schedule, task);
  const readinessLabel = task.readiness?.ready === false
    ? template(t("planning.board.blockers", "{count} blockers"), { count: formatNumber(task.readiness.blocking_count) })
    : t("planning.readiness.ready", "Ready");
  const moveLabel = template(t("planning.board.moveTask", "Move task {task}"), { task: task.title });
  const progressLabel = template(t("planning.board.progress", "Progress for {task}: {progress}%"), {
    task: task.title,
    progress: formatNumber(task.progress),
  });
  return (
    <article
      className={`planning-flow-card${pending ? " is-moving" : ""}`}
      data-planning-task-id={task.id}
      aria-label={template(t("planning.board.taskCard", "Task {wbs} {task}"), { wbs: task.wbs || "-", task: task.title })}
    >
      <header>
        <span className="planning-flow-card-wbs"><bdi dir="auto">{task.wbs || "-"}</bdi></span>
        <strong><bdi dir="auto">{task.title}</bdi></strong>
      </header>
      <div className="planning-flow-card-badges">
        {task.critical ? <span className="planning-flow-card-critical">{t("planning.board.critical", "Critical")}</span> : null}
        <span className={task.readiness?.ready === false ? "planning-flow-card-blocked" : ""}>{readinessLabel}</span>
      </div>
      <small>{formatDate(task.start)} – {formatDate(task.end)}</small>
      <div className="planning-flow-card-progress">
        <progress max={100} value={task.progress} aria-label={progressLabel} />
        <span aria-hidden="true">{formatNumber(task.progress)}%</span>
      </div>
      <div className="planning-flow-card-actions">
        <WorkspaceActionButton
          action="open"
          className="planning-flow-card-open"
          aria-label={template(t("planning.board.openTask", "Open task {task}"), { task: task.title })}
          onClick={onOpen}
        >
          {t("command.open", "Open")}
        </WorkspaceActionButton>
        <label className="planning-flow-move-control">
          <span className="visually-hidden">{moveLabel}</span>
          <select
            ref={registerMoveControl}
            aria-label={moveLabel}
            aria-busy={pending ? "true" : undefined}
            data-task-move={task.id}
            disabled={readOnly || busy || pending || !targets.length}
            value=""
            onChange={(event) => onMove(event.target.value as PlanningTaskStatus)}
          >
            <option value="">{pending ? t("planning.board.movingShort", "Moving…") : t("planning.board.move", "Move")}</option>
            {targets.map((target) => (
              <option key={target.status} value={target.status}>
                {template(t("planning.board.moveTo", "Move to {status}"), { status: localizedStatusLabel(schedule, target.status, t) })}
              </option>
            ))}
          </select>
        </label>
      </div>
    </article>
  );
}

export function localizedStatusLabel(
  schedule: PlanningSchedule,
  status: PlanningTaskStatus,
  t: (key: string, fallback?: string) => string,
) {
  const serverLabel = schedule.task_flow?.statuses.find((item) => item.status === status)?.display_label || status;
  return t(`planning.taskStatus.${status}`, serverLabel);
}

function template(value: string, replacements: Record<string, string>) {
  return Object.entries(replacements).reduce((result, [key, replacement]) => result.replaceAll(`{${key}}`, replacement), value);
}

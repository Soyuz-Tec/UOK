import { useRef, useState } from "react";
import type { DragEvent as ReactDragEvent, MouseEvent } from "react";

import { WorkspaceActionsMenu } from "@uok/shared/actions";
import { InlineTextEdit } from "@uok/shared/forms";

import { localizedPlanningStatusLabel, planningFlowTargets } from "./planningFlowBoardModel";
import type { PlanningSchedule, PlanningTask, PlanningTaskStatus } from "./types";

type Translate = (key: string, fallback?: string) => string;

export function PlanningFlowCard({
  busy,
  dragging,
  formatDate,
  formatNumber,
  pending,
  readOnly,
  registerOpenControl,
  schedule,
  task,
  t,
  onDragBegin,
  onDragFinish,
  onMove,
  onOpen,
  onTitleChange,
}: {
  busy: boolean;
  dragging: boolean;
  formatDate: (value: Date | string) => string;
  formatNumber: (value: number) => string;
  pending: boolean;
  readOnly: boolean;
  registerOpenControl: (control: HTMLButtonElement | null) => void;
  schedule: PlanningSchedule;
  task: PlanningTask;
  t: Translate;
  onDragBegin: () => void;
  onDragFinish: () => void;
  onMove: (status: PlanningTaskStatus) => void;
  onOpen: () => void;
  onTitleChange: (title: string) => Promise<boolean>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const openSurfaceRef = useRef<HTMLButtonElement | null>(null);
  const suppressOpenUntil = useRef(0);
  const targets = planningFlowTargets(schedule, task);
  const canDrag = !readOnly && !busy && !pending && targets.length > 0;
  const readinessLabel = task.readiness?.ready === false
    ? template(t("planning.board.blockers", "{count} blockers"), { count: formatNumber(task.readiness.blocking_count) })
    : t("planning.readiness.ready", "Ready");
  const openLabel = template(t("planning.board.openTask", "Open task {task}"), { task: task.title });
  const titleLabel = template(t("planning.board.taskTitle", "Task title for {task}"), { task: task.title });
  const progressLabel = template(t("planning.board.progress", "Progress for {task}: {progress}%"), {
    task: task.title,
    progress: formatNumber(task.progress),
  });

  return (
    <article
      className={`planning-flow-card${pending ? " is-moving" : ""}${dragging ? " is-dragging" : ""}${menuOpen ? " is-menu-open" : ""}`}
      data-flow-draggable={canDrag ? "true" : "false"}
      data-planning-task-id={task.id}
      draggable={canDrag}
      aria-busy={pending ? "true" : undefined}
      aria-label={template(t("planning.board.taskCard", "Task {wbs} {task}"), { wbs: task.wbs || "-", task: task.title })}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
    >
      <button
        ref={(control) => {
          openSurfaceRef.current = control;
          registerOpenControl(control);
        }}
        type="button"
        className="planning-flow-card-open-surface"
        aria-label={openLabel}
        onClick={handleOpen}
      />
      <header>
        <span className="planning-flow-card-wbs"><bdi dir="auto">{task.wbs || "-"}</bdi></span>
        <div
          className={`planning-flow-card-title${readOnly ? " is-read-only" : ""}`}
          data-flow-no-drag={readOnly ? undefined : "true"}
          onClick={readOnly ? openFromTitle : stopInteraction}
          onDragStart={readOnly ? undefined : stopDrag}
          onPointerDown={readOnly ? undefined : stopInteraction}
        >
          {readOnly ? (
            <strong><bdi dir="auto">{task.title}</bdi></strong>
          ) : (
            <InlineTextEdit
              label={titleLabel}
              value={task.title}
              disabled={busy || pending}
              failureMessage={t("planning.board.titleNotApplied", "Task title was not updated. Review the Planning notice.")}
              validate={validateTitle}
              onCommit={async (title) => {
                if (!(await onTitleChange(title))) throw new Error("Task title update was not applied");
              }}
            />
          )}
        </div>
        {!readOnly && targets.length ? (
          <div
            className="planning-flow-card-menu"
            data-flow-no-drag="true"
            onClick={stopInteraction}
            onDragStart={stopDrag}
            onPointerDown={stopInteraction}
          >
            <WorkspaceActionsMenu
              className="planning-flow-card-actions-menu"
              label={template(t("planning.board.moreActions", "More actions for {task}"), { task: task.title })}
              onOpenChange={setMenuOpen}
              items={targets.map((target) => ({
                id: `move-${target.status}`,
                action: "move" as const,
                label: template(t("planning.board.moveTo", "Move to {status}"), {
                  status: localizedPlanningStatusLabel(schedule, target.status, t),
                }),
                disabled: busy || pending,
                onSelect: () => onMove(target.status),
              }))}
            />
          </div>
        ) : null}
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
    </article>
  );

  function handleDragStart(event: ReactDragEvent<HTMLElement>) {
    if (!canDrag || isNoDragTarget(event.target)) {
      event.preventDefault();
      return;
    }
    suppressOpenUntil.current = Date.now() + 500;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
    onDragBegin();
  }

  function handleDragEnd() {
    suppressOpenUntil.current = Date.now() + 250;
    onDragFinish();
  }

  function handleOpen(event: MouseEvent<HTMLButtonElement>) {
    if (Date.now() < suppressOpenUntil.current) {
      event.preventDefault();
      return;
    }
    onOpen();
  }

  function openFromTitle() {
    openSurfaceRef.current?.focus();
    onOpen();
  }

  function validateTitle(value: string) {
    const length = Array.from(value).length;
    if (length < 2) return t("planning.board.titleTooShort", "Enter a task title with at least 2 characters.");
    if (length > 180) return t("planning.board.titleTooLong", "Keep the task title to 180 characters or fewer.");
    return "";
  }
}

function isNoDragTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("[data-flow-no-drag='true']"));
}

function stopInteraction(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

function stopDrag(event: ReactDragEvent<HTMLElement>) {
  event.preventDefault();
  event.stopPropagation();
}

function template(value: string, replacements: Record<string, string>) {
  return Object.entries(replacements).reduce((result, [key, replacement]) => result.replaceAll(`{${key}}`, replacement), value);
}

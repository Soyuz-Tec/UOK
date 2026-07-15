import { useMemo } from "react";

import { WorkspaceActionButton } from "@uok/shared/actions";
import { useUokLocalization } from "@uok/shared/localization";
import { ResizableDataTable, type DataTableColumn } from "@uok/shared/tables";

import { localizedStatusLabel } from "./PlanningFlowBoard";
import type { PlanningSchedule, PlanningTask } from "./types";

export function PlanningScheduleList({
  schedule,
  onTaskOpen,
}: {
  schedule: PlanningSchedule;
  onTaskOpen: (taskId: string) => void;
}) {
  const { formatDate, formatNumber, t } = useUokLocalization();
  const columns = useMemo<DataTableColumn<PlanningTask>[]>(() => [
    { id: "wbs", header: t("planning.column.wbs", "WBS"), defaultWidth: 90, minWidth: 72, renderCell: (task) => <bdi dir="auto">{task.wbs || "-"}</bdi> },
    { id: "task", header: t("planning.column.task", "Task"), defaultWidth: 260, minWidth: 180, renderCell: (task) => <strong><bdi dir="auto">{task.title}</bdi></strong>, getCellTitle: (task) => task.title },
    { id: "type", header: t("planning.list.type", "Type"), defaultWidth: 110, renderCell: (task) => t(`planning.taskType.${task.task_type}`, task.task_type) },
    { id: "status", header: t("planning.column.status", "Status"), defaultWidth: 130, renderCell: (task) => localizedStatusLabel(schedule, task.status, t) },
    { id: "start", header: t("planning.column.start", "Start"), defaultWidth: 150, renderCell: (task) => formatDate(task.start) },
    { id: "end", header: t("planning.column.end", "End"), defaultWidth: 150, renderCell: (task) => formatDate(task.end) },
    { id: "progress", header: t("planning.list.progress", "Progress"), defaultWidth: 100, renderCell: (task) => `${formatNumber(task.progress)}%` },
    {
      id: "readiness",
      header: t("planning.column.readiness", "Readiness"),
      defaultWidth: 130,
      renderCell: (task) => task.readiness?.ready === false
        ? `${formatNumber(task.readiness.blocking_count)} ${t(task.readiness.blocking_count === 1 ? "planning.health.blocker.one" : "planning.health.blocker.many", task.readiness.blocking_count === 1 ? "blocker" : "blockers")}`
        : t("planning.readiness.ready", "Ready"),
    },
    {
      id: "actions",
      header: t("planning.list.actions", "Actions"),
      defaultWidth: 112,
      minWidth: 100,
      resizable: false,
      renderCell: (task) => (
        <WorkspaceActionButton
          action="open"
          className="planning-list-open"
          aria-label={t("planning.board.openTask", "Open task {task}").replace("{task}", task.title)}
          onClick={() => onTaskOpen(task.id)}
        >
          {t("command.open", "Open")}
        </WorkspaceActionButton>
      ),
    },
  ], [formatDate, formatNumber, onTaskOpen, schedule, t]);

  return (
    <div className="planning-read-view planning-task-list">
      <ResizableDataTable
        ariaLabel={t("planning.list.label", "Planning task list")}
        columns={columns}
        emptyState={t("planning.list.empty", "No tasks match the current filters.")}
        getRowKey={(task) => task.id}
        rows={schedule.tasks}
        storageKey={`planning.task-list.${schedule.project.id}`}
        tableClassName="planning-read-table"
      />
    </div>
  );
}

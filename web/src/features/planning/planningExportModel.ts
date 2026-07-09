import { csvContent, downloadExportArtifact, exportFilename, htmlDocumentContent, jsonContent, textArtifact, xmlText } from "../../shared/exporting";
import { buildTimeline, dateValue, durationUnits, taskColorClass, xForDate, type TimelineScale } from "./planningGanttModel";
import type { ViewDensity } from "./planningTimelineModel";
import type { PlanningSchedule } from "./types";

export function planningScheduleCsv(schedule: PlanningSchedule) {
  const header = ["WBS", "Task", "Type", "Status", "Start", "End", "Progress", "Critical", "Scheduling", "Constraint", "Constraint date"];
  const rows = schedule.tasks.map((task) => [task.wbs || "", task.title, task.task_type, task.status, task.start, task.end, `${task.progress}`, task.critical ? "yes" : "no", task.scheduling_mode || "auto", task.constraint_type || "", task.constraint_date || ""]);
  return csvContent([header, ...rows]);
}

export function planningImportTemplateCsv() {
  const header = ["Task", "Type", "Parent WBS", "Start", "End", "Progress", "Status", "Assigned resource", "Dependency predecessor WBS", "Dependency type", "Lag days"];
  const example = ["Example task", "task", "", "YYYY-MM-DD", "YYYY-MM-DD", "0", "planned", "", "", "finish_to_start", "0"];
  return csvContent([header, example]);
}

export function planningProjectExchangeJson(schedule: PlanningSchedule) {
  return jsonContent({
    format: "uok.planning.schedule",
    version: 1,
    project: schedule.project,
    calendar: schedule.calendar || null,
    tasks: schedule.tasks,
    dependencies: schedule.dependencies,
    resources: schedule.resources,
    assignments: schedule.assignments,
    baselines: schedule.baselines,
  });
}

export function planningScheduleDocumentHtml(schedule: PlanningSchedule, generatedAt?: string) {
  const taskById = new Map(schedule.tasks.map((task) => [task.id, task]));
  const resourcesById = new Map(schedule.resources.map((resource) => [resource.id, resource]));
  const assignmentRows = schedule.assignments.map((assignment) => {
    const task = taskById.get(assignment.task_id);
    const resource = resourcesById.get(assignment.resource_id);
    return [
      task?.wbs || "-",
      task?.title || assignment.task_id,
      resource?.name || assignment.resource_id,
      resource?.role || "-",
      `${assignment.allocation_percent}%`,
    ];
  });

  return htmlDocumentContent({
    title: `${schedule.project.name} schedule`,
    subtitle: "UOK planning schedule document",
    generatedAt,
    sections: [
      {
        heading: "Project summary",
        definitionList: [
          ["Project", schedule.project.name],
          ["Status", schedule.project.status || "No status"],
          ["Date range", `${schedule.project.start} to ${schedule.project.end}`],
          ["Tasks", `${schedule.tasks.length}`],
          ["Dependencies", `${schedule.dependencies.length}`],
          ["Resources", `${schedule.resources.length}`],
          ["Validation", schedule.validation.ok ? "Valid" : "Needs review"],
        ],
      },
      {
        heading: "Tasks",
        tables: [{
          headers: ["WBS", "Task", "Type", "Status", "Start", "End", "Duration", "Progress", "Critical", "Scheduling", "Constraint"],
          rows: [...schedule.tasks]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((task) => [
              task.wbs || "-",
              task.title,
              task.task_type,
              task.status,
              task.start,
              task.end,
              `${task.duration_days}d`,
              `${task.progress}%`,
              task.critical ? "yes" : "no",
              task.scheduling_mode || "auto",
              task.constraint_type ? `${task.constraint_type} ${task.constraint_date || ""}`.trim() : "-",
            ]),
        }],
      },
      {
        heading: "Dependencies",
        tables: [{
          headers: ["Predecessor", "Successor", "Type", "Lag days"],
          rows: schedule.dependencies.map((dependency) => [
            taskLabel(taskById.get(dependency.predecessor_task_id), dependency.predecessor_task_id),
            taskLabel(taskById.get(dependency.successor_task_id), dependency.successor_task_id),
            dependency.dependency_type,
            `${dependency.lag_days}`,
          ]),
        }],
      },
      {
        heading: "Resources",
        tables: [{
          headers: ["WBS", "Task", "Resource", "Role", "Allocation"],
          rows: assignmentRows,
        }],
      },
      {
        heading: "Calendar",
        definitionList: [
          ["Calendar", schedule.calendar?.name || "Not configured"],
          ["Working days", schedule.calendar?.working_days.join(", ") || "-"],
          ["Holidays", schedule.calendar?.holidays.join(", ") || "-"],
          ["Ignored periods", schedule.calendar?.ignored_periods?.map((period) => `${period.start} to ${period.end}`).join(", ") || "-"],
        ],
      },
    ],
  });
}

export function planningTimelineSvg(schedule: PlanningSchedule, scale: TimelineScale = "day", viewDensity: ViewDensity = "standard") {
  const chart = buildTimeline(schedule, scale, viewDensity);
  const tasks = [...schedule.tasks].sort((a, b) => a.sort_order - b.sort_order);
  const labelWidth = 260;
  const rowHeight = 36;
  const headerHeight = 58;
  const timelineWidth = Math.max(chart.units.length * chart.cellWidth, 480);
  const width = labelWidth + timelineWidth + 32;
  const height = headerHeight + Math.max(tasks.length, 1) * rowHeight + 28;
  const body = tasks.length ? tasks.map((task, index) => taskSvg(task, index)).join("") : `<text x="${labelWidth + 20}" y="${headerHeight + 30}" fill="#64748b" font-size="13">No visible planning tasks</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${xmlText(schedule.project.name)} timeline export">
<rect width="${width}" height="${height}" fill="#ffffff"/>
<text x="20" y="28" fill="#0f172a" font-family="Arial, sans-serif" font-size="16" font-weight="700">${xmlText(schedule.project.name)}</text>
<text x="20" y="48" fill="#64748b" font-family="Arial, sans-serif" font-size="12">${xmlText(schedule.project.start)} to ${xmlText(schedule.project.end)}</text>
${chart.units.map((unit, index) => `<g><rect x="${labelWidth + index * chart.cellWidth}" y="0" width="${chart.cellWidth}" height="${height}" fill="${unit.holiday ? "#fef3c7" : unit.weekend ? "#f8fafc" : "#ffffff"}" stroke="#e2e8f0"/><text x="${labelWidth + index * chart.cellWidth + 8}" y="38" fill="#475569" font-family="Arial, sans-serif" font-size="11">${xmlText(unit.label)}</text></g>`).join("")}
${body}
</svg>`;

  function taskSvg(task: PlanningSchedule["tasks"][number], index: number) {
    const rowTop = headerHeight + index * rowHeight;
    const barX = labelWidth + xForDate(dateValue(task.start), chart.start, scale, chart.cellWidth);
    const barWidth = Math.max(durationUnits(task, scale) * chart.cellWidth, 12);
    const barY = rowTop + 9;
    const color = statusColor(taskColorClass(task));
    const label = `${task.wbs || ""} ${task.title}`.trim();
    const progressWidth = Math.max(0, Math.min(100, task.progress)) / 100 * barWidth;
    if (task.task_type === "milestone") {
      const cx = barX + 8;
      const cy = barY + 8;
      return `<g><text x="20" y="${rowTop + 23}" fill="#334155" font-family="Arial, sans-serif" font-size="12">${xmlText(label)}</text><polygon points="${cx},${cy - 9} ${cx + 9},${cy} ${cx},${cy + 9} ${cx - 9},${cy}" fill="#7c3aed"/><text x="${cx + 16}" y="${cy + 4}" fill="#334155" font-family="Arial, sans-serif" font-size="11">${xmlText(task.status)}</text></g>`;
    }
    return `<g><text x="20" y="${rowTop + 23}" fill="#334155" font-family="Arial, sans-serif" font-size="12">${xmlText(label)}</text><rect x="${barX}" y="${barY}" width="${barWidth}" height="16" rx="4" fill="${task.task_type === "summary" ? "#166534" : color}"/><rect x="${barX}" y="${barY}" width="${progressWidth}" height="16" rx="4" fill="rgba(255,255,255,0.35)"/><text x="${barX + 8}" y="${barY + 12}" fill="#ffffff" font-family="Arial, sans-serif" font-size="11">${xmlText(task.title)}</text></g>`;
  }
}

export function planningExportFilename(schedule: PlanningSchedule, suffix: string, extension = "csv") {
  return exportFilename(schedule.project.name, suffix, extension);
}

export function exportScheduleCsv(schedule: PlanningSchedule) {
  downloadExportArtifact(textArtifact(planningExportFilename(schedule, "schedule"), planningScheduleCsv(schedule), "text/csv;charset=utf-8"));
}

export function exportPlanningImportTemplate(schedule: PlanningSchedule) {
  downloadExportArtifact(textArtifact(planningExportFilename(schedule, "import-template"), planningImportTemplateCsv(), "text/csv;charset=utf-8"));
}

export function exportPlanningProjectJson(schedule: PlanningSchedule) {
  downloadExportArtifact(textArtifact(planningExportFilename(schedule, "project", "json"), planningProjectExchangeJson(schedule), "application/json;charset=utf-8"));
}

export function exportPlanningTimelineSvg(schedule: PlanningSchedule) {
  downloadExportArtifact(textArtifact(planningExportFilename(schedule, "timeline", "svg"), planningTimelineSvg(schedule), "image/svg+xml;charset=utf-8"));
}

export function exportPlanningScheduleDocument(schedule: PlanningSchedule) {
  downloadExportArtifact(textArtifact(planningExportFilename(schedule, "schedule-document", "html"), planningScheduleDocumentHtml(schedule, new Date().toISOString()), "text/html;charset=utf-8"));
}

function statusColor(status: string) {
  if (status === "complete") return "#15803d";
  if (status === "overdue") return "#b91c1c";
  if (status === "blocked") return "#92400e";
  if (status === "in-progress") return "#2563eb";
  return "#64748b";
}

function taskLabel(task: PlanningSchedule["tasks"][number] | undefined, fallback: string) {
  if (!task) return fallback;
  return `${task.wbs || "-"} ${task.title}`;
}

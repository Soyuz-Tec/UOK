import type { PlanningSchedule } from "./types";

export function planningScheduleCsv(schedule: PlanningSchedule) {
  const header = ["WBS", "Task", "Type", "Status", "Start", "End", "Progress", "Critical"];
  const rows = schedule.tasks.map((task) => [task.wbs || "", task.title, task.task_type, task.status, task.start, task.end, `${task.progress}`, task.critical ? "yes" : "no"]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export function planningImportTemplateCsv() {
  const header = ["Task", "Type", "Parent WBS", "Start", "End", "Progress", "Status", "Assigned resource", "Dependency predecessor WBS", "Dependency type", "Lag days"];
  const example = ["Example task", "task", "", "YYYY-MM-DD", "YYYY-MM-DD", "0", "planned", "", "", "finish_to_start", "0"];
  return [header, example].map((row) => row.map(csvCell).join(",")).join("\n");
}

export function planningProjectExchangeJson(schedule: PlanningSchedule) {
  return JSON.stringify(
    {
      format: "uok.planning.schedule",
      version: 1,
      project: schedule.project,
      calendar: schedule.calendar || null,
      tasks: schedule.tasks,
      dependencies: schedule.dependencies,
      resources: schedule.resources,
      assignments: schedule.assignments,
      baselines: schedule.baselines,
    },
    null,
    2,
  );
}

export function planningExportFilename(schedule: PlanningSchedule, suffix: string, extension = "csv") {
  return `${schedule.project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${suffix}.${extension}`;
}

export function exportScheduleCsv(schedule: PlanningSchedule) {
  downloadTextFile(planningExportFilename(schedule, "schedule"), planningScheduleCsv(schedule), "text/csv;charset=utf-8");
}

export function exportPlanningImportTemplate(schedule: PlanningSchedule) {
  downloadTextFile(planningExportFilename(schedule, "import-template"), planningImportTemplateCsv(), "text/csv;charset=utf-8");
}

export function exportPlanningProjectJson(schedule: PlanningSchedule) {
  downloadTextFile(planningExportFilename(schedule, "project", "json"), planningProjectExchangeJson(schedule), "application/json;charset=utf-8");
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

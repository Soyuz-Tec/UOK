import { describe, expect, it } from "vitest";

import { planningExportFilename, planningImportTemplateCsv, planningProjectExchangeJson, planningScheduleCsv } from "./planningExportModel";
import type { PlanningSchedule, PlanningTask } from "./types";

describe("planning export model", () => {
  it("exports visible schedule rows as quoted CSV", () => {
    const csv = planningScheduleCsv(schedule());

    expect(csv.split("\n")[0]).toBe("\"WBS\",\"Task\",\"Type\",\"Status\",\"Start\",\"End\",\"Progress\",\"Critical\"");
    expect(csv).toContain("\"1.1\",\"Scope, design\",\"task\",\"planned\",\"2026-08-01\",\"2026-08-03\",\"20\",\"yes\"");
  });

  it("builds a stable import template", () => {
    const csv = planningImportTemplateCsv();

    expect(csv.split("\n")[0]).toContain("\"Dependency predecessor WBS\"");
    expect(csv).toContain("\"Example task\",\"task\",\"\",\"YYYY-MM-DD\",\"YYYY-MM-DD\"");
  });

  it("uses the project name in export filenames", () => {
    expect(planningExportFilename(schedule(), "import-template")).toBe("pilot-delivery-import-template.csv");
    expect(planningExportFilename(schedule(), "project", "json")).toBe("pilot-delivery-project.json");
  });

  it("exports a deterministic UOK project exchange model", () => {
    const payload = JSON.parse(planningProjectExchangeJson(schedule()));

    expect(payload.format).toBe("uok.planning.schedule");
    expect(payload.version).toBe(1);
    expect(payload.project.name).toBe("Pilot Delivery");
    expect(payload.tasks).toHaveLength(1);
    expect(payload.dependencies).toEqual([]);
  });
});

function schedule(): PlanningSchedule {
  return {
    project: { id: "project-1", name: "Pilot Delivery", status: "planned", start: "2026-08-01", end: "2026-08-10" },
    tasks: [task()],
    dependencies: [],
    calendar: { name: "Standard", working_days: [1, 2, 3, 4, 5], holidays: [] },
    resources: [],
    assignments: [],
    baselines: [],
    validation: { ok: true, violations: [], warnings: [] },
  };
}

function task(): PlanningTask {
  return {
    id: "task-1",
    project_id: "project-1",
    title: "Scope, design",
    task_type: "task",
    status: "planned",
    start: "2026-08-01",
    end: "2026-08-03",
    duration_days: 3,
    progress: 20,
    sort_order: 1,
    critical: true,
    wbs: "1.1",
  };
}

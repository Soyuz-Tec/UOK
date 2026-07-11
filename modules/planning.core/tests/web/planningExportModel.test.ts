import { describe, expect, it } from "vitest";

import { planningExportFilename, planningImportTemplateCsv, planningProjectExchangeJson, planningScheduleCsv, planningScheduleDocumentHtml, planningTimelineSvg } from "../../web/src/planningExportModel";
import type { PlanningSchedule, PlanningTask } from "../../web/src/types";

describe("planning export model", () => {
  it("exports visible schedule rows as quoted CSV", () => {
    const csv = planningScheduleCsv(schedule());

    expect(csv.split("\n")[0]).toBe("\"WBS\",\"Task\",\"Type\",\"Status\",\"Start\",\"End\",\"Progress\",\"Critical\",\"Scheduling\",\"Constraint\",\"Constraint date\"");
    expect(csv).toContain("\"1.1\",\"Scope, design\",\"task\",\"planned\",\"2026-08-01\",\"2026-08-03\",\"20\",\"yes\",\"manual\",\"must_start_on\",\"2026-08-01\"");
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

  it("exports a first-party SVG timeline image", () => {
    const svg = planningTimelineSvg(schedule());

    expect(svg).toContain("<svg xmlns=\"http://www.w3.org/2000/svg\"");
    expect(svg).toContain("Pilot Delivery");
    expect(svg).toContain("Scope, design");
    expect(svg).toContain("2026-08-01 to 2026-08-10");
  });

  it("exports a first-party HTML schedule document", () => {
    const html = planningScheduleDocumentHtml(schedule(), "2026-08-01T00:00:00.000Z");

    expect(html).toContain("<title>Pilot Delivery schedule</title>");
    expect(html).toContain("UOK planning schedule document");
    expect(html).toContain("<h2>Project summary</h2>");
    expect(html).toContain("<h2>Tasks</h2>");
    expect(html).toContain("Scope, design");
    expect(html).toContain("manual");
    expect(html).toContain("must_start_on 2026-08-01");
    expect(html).toContain("2026-08-05 to 2026-08-06");
    expect(html).toContain("2026-08-01T00:00:00.000Z");
  });
});

function schedule(): PlanningSchedule {
  return {
    project: { id: "project-1", name: "Pilot Delivery", status: "active", start: "2026-08-01", end: "2026-08-10", target_finish: "2026-08-10", calculated_finish: "2026-08-10", revision: 1 },
    tasks: [task()],
    dependencies: [],
    calendar: { name: "Standard", working_days: [1, 2, 3, 4, 5], holidays: [], ignored_periods: [{ start: "2026-08-05", end: "2026-08-06" }] },
    resources: [],
    assignments: [],
    links: [],
    baselines: [],
    validation: { ok: true, violations: [], warnings: [] },
  };
}

function task(): PlanningTask {
  return {
    id: "task-1",
    project_id: "project-1",
    version: 1,
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
    scheduling_mode: "manual",
    constraint_type: "must_start_on",
    constraint_date: "2026-08-01",
  };
}

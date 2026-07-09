import { expect, test, type Page } from "@playwright/test";

const sampleProject = {
  id: "project-proof",
  name: "UOK Gantt Proof",
  status: "active",
  start: "2026-08-01",
  end: "2026-08-20",
  updated_at: "2026-08-01T00:00:00Z",
};

const sampleSchedule = {
  project: sampleProject,
  validation: { ok: true, violations: [], warnings: ["Planner is allocated 120% on 2026-08-06"] },
  tasks: [
    {
      id: "task-summary",
      project_id: sampleProject.id,
      parent_task_id: null,
      wbs: "1",
      title: "Pilot delivery",
      task_type: "summary",
      status: "planned",
      start: "2026-08-01",
      end: "2026-08-13",
      duration_days: 9,
      progress: 20,
      sort_order: 0,
      critical: false,
      total_slack_days: 0,
      baseline_start: "2026-08-01",
      baseline_end: "2026-08-12",
      start_variance_days: 0,
      end_variance_days: 1,
    },
    {
      id: "task-1",
      project_id: sampleProject.id,
      parent_task_id: "task-summary",
      wbs: "1.1",
      title: "Define schedule scope",
      task_type: "task",
      status: "planned",
      start: "2026-08-01",
      end: "2026-08-03",
      duration_days: 3,
      progress: 40,
      sort_order: 1,
      critical: true,
      total_slack_days: 0,
      baseline_start: "2026-08-01",
      baseline_end: "2026-08-03",
      start_variance_days: 0,
      end_variance_days: 0,
    },
    {
      id: "task-2",
      project_id: sampleProject.id,
      parent_task_id: "task-summary",
      wbs: "1.2",
      title: "Build integrated Gantt with dependency validation",
      task_type: "task",
      status: "planned",
      start: "2026-08-04",
      end: "2026-08-10",
      duration_days: 7,
      progress: 0,
      sort_order: 2,
      critical: true,
      total_slack_days: 0,
      baseline_start: "2026-08-04",
      baseline_end: "2026-08-09",
      start_variance_days: 0,
      end_variance_days: 1,
    },
    {
      id: "task-3",
      project_id: sampleProject.id,
      parent_task_id: "task-summary",
      wbs: "1.3",
      title: "Pilot review milestone",
      task_type: "milestone",
      status: "planned",
      start: "2026-08-13",
      end: "2026-08-13",
      duration_days: 0,
      progress: 0,
      sort_order: 3,
      critical: true,
      total_slack_days: 0,
      baseline_start: "2026-08-12",
      baseline_end: "2026-08-12",
      start_variance_days: 1,
      end_variance_days: 1,
    },
  ],
  dependencies: [
    {
      id: "dep-1",
      project_id: sampleProject.id,
      predecessor_task_id: "task-1",
      successor_task_id: "task-2",
      dependency_type: "finish_to_start",
      lag_days: 1,
    },
  ],
  calendar: { name: "Standard", working_days: [1, 2, 3, 4, 5], holidays: ["2026-08-14"] },
  resources: [{ id: "resource-1", project_id: sampleProject.id, name: "Planner", role: "Scheduling" }],
  assignments: [{ id: "assignment-1", task_id: "task-2", resource_id: "resource-1", allocation_percent: 120 }],
  baselines: [{ id: "baseline-1", project_id: sampleProject.id, name: "Initial baseline", created_at: "2026-08-01T00:00:00Z" }],
};

test("UOK proof gate covers planning Gantt usability and visual stability", async ({ page }) => {
  const consoleErrors: string[] = [];
  const dependencyPayloads: unknown[] = [];
  const taskPayloads: unknown[] = [];
  const taskUpdatePayloads: unknown[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await installMockApi(page, dependencyPayloads, taskPayloads, taskUpdatePayloads);

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 900, height: 760 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await openPlanning(page);

    await expect(page.getByRole("heading", { name: "UOK Gantt Proof" })).toBeVisible();
    await expect(page.getByLabel("Gantt toolbar")).toBeVisible();
    await expect(page.getByRole("button", { name: "Gantt chart", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByLabel("Project metadata")).toBeVisible();
    await expect(page.getByLabel("Timeline utilities")).toBeVisible();
    await expect(page.getByLabel("Saved planning views")).toBeVisible();
    await expect(page.getByLabel("Planning view name")).toBeVisible();
    await expect(page.getByLabel("Planning search and filters")).toBeVisible();
    await expect(page.getByLabel("Search planning tasks")).toBeVisible();
    await expect(page.getByLabel("Timeline zoom")).toBeVisible();
    await expect(page.getByText("Fields")).toBeVisible();
    await expect(page.getByText("Filter")).toBeVisible();
    await expect(page.getByRole("button", { name: "Columns", exact: true })).toBeVisible();
    await expect(page.getByLabel("Planning Gantt chart")).toBeVisible();
    await expect(page.locator(".planning-owned-grid-header .column-resize-handle")).toHaveCount(4);
    await expect(page.locator(".planning-owned-resize-handle")).toHaveCount(6);
    await expect(page.locator(".planning-owned-progress-handle")).toHaveCount(3);
    await expect(page.locator(".planning-owned-link-handle")).toHaveCount(8);
    await expect(page.locator(".planning-owned-status-code")).toHaveCount(4);
    await expect(page.locator(".planning-owned-status-code").getByText("CRIT")).toHaveCount(3);
    await expect(page.locator(".planning-owned-tooltip")).toHaveCount(4);
    if (viewport.width > 980) {
      const taskRequests = taskPayloads.length;
      await page.getByRole("button", { name: "Task actions for Define schedule scope" }).click();
      await expect(page.getByRole("menu", { name: "Task actions for Define schedule scope" })).toBeVisible();
      await page.getByRole("menuitem", { name: /Duplicate task/ }).click();
      await expect.poll(() => taskPayloads.length).toBe(taskRequests + 1);
      expect(taskPayloads.at(-1)).toMatchObject({ title: "Define schedule scope copy", task_type: "task", parent_task_id: "task-summary", status: "planned", progress: 40 });
      const scopeRow = page.locator(".planning-owned-grid-row").filter({ hasText: "Define schedule scope" }).first();
      const ganttRow = page.locator(".planning-owned-grid-row").filter({ hasText: "Build integrated Gantt with dependency validation" }).first();
      await scopeRow.focus();
      await scopeRow.press("ArrowDown");
      await expect(ganttRow).toBeFocused();
      const taskUpdates = taskUpdatePayloads.length;
      await ganttRow.press("Control+Enter");
      await expect.poll(() => taskUpdatePayloads.length).toBe(taskUpdates + 1);
      expect(taskUpdatePayloads.at(-1)).toMatchObject({ status: "complete", progress: 100 });
      const linkRequests = dependencyPayloads.length;
      await page.getByRole("button", { name: "Start dependency from Define schedule scope" }).press("Enter");
      await expect(page.locator(".planning-gantt-shell")).toHaveClass(/planning-linking/);
      await page.getByRole("button", { name: "Finish dependency at Pilot review milestone" }).press("Enter");
      await expect.poll(() => dependencyPayloads.length).toBe(linkRequests + 1);
      expect(dependencyPayloads.at(-1)).toMatchObject({ predecessor_task_id: "task-1", successor_task_id: "task-3", dependency_type: "finish_to_start", lag_days: 0 });
    }
    await page.getByLabel("Search planning tasks").fill("integrated");
    await expect(page.locator(".planning-owned-grid-body").getByText("Build integrated Gantt with dependency validation")).toBeVisible();
    await page.getByLabel("Search planning tasks").fill("");
    if (viewport.width > 980) {
      const taskHeader = page.locator(".planning-owned-grid-header [role='columnheader']").nth(1);
      const standardRowHeight = await page.locator(".planning-owned-grid-row").first().evaluate((row) => row.getBoundingClientRect().height);
      await taskHeader.dblclick();
      await expect.poll(() => page.locator(".planning-owned-grid-row").first().evaluate((row) => row.getBoundingClientRect().height)).toBeLessThan(standardRowHeight);
      await taskHeader.dblclick();
    }
    await page.getByRole("button", { name: "Board", exact: true }).click();
    await expect(page.getByLabel("Planning board")).toBeVisible();
    await page.getByRole("button", { name: "Gantt chart", exact: true }).click();
    await expect(page.getByLabel("Planning Gantt chart")).toBeVisible();
    await page.getByRole("button", { name: "Task", exact: true }).focus();
    await expect(page.getByRole("button", { name: "Task", exact: true })).toBeFocused();
    await expect.poll(() => page.locator(".planning-gantt-shell").getByText("Build integrated Gantt with dependency validation").count()).toBeGreaterThan(0);
    for (const scale of ["hour", "day", "week", "month", "quarter", "year"]) {
      await expect(page.getByRole("button", { name: scale, exact: true })).toBeVisible();
    }
    await page.getByRole("button", { name: "Focus", exact: true }).click();
    await expect(page.locator(".planning-timeline-workbench")).toHaveClass(/focus-mode/);
    await expect(page.getByRole("button", { name: "Exit focus", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Exit focus", exact: true }).click();
    await expect(page.locator(".planning-timeline-workbench")).not.toHaveClass(/focus-mode/);
    await expect(page.getByLabel("Task editor")).toBeVisible();
    await page.getByRole("tab", { name: "Links" }).click();
    await expect(page.getByLabel("Dependency editor")).toBeVisible();
    await page.getByRole("tab", { name: "Calendar" }).click();
    await expect(page.getByLabel("Calendar and baseline")).toBeVisible();
    await page.getByRole("tab", { name: "Resources" }).click();
    await expect(page.getByLabel("Resource assignments")).toBeVisible();
    await page.getByRole("tab", { name: "Status" }).click();
    await expect(page.getByLabel("Planning validation status")).toBeVisible();

    const layout = await page.evaluate(() => {
      const shell = document.querySelector(".shell")?.getBoundingClientRect();
      const workflowHeader = document.querySelector(".planning-workspace .workflow-header")?.getBoundingClientRect();
      const toolbar = document.querySelector(".planning-gantt-toolbar")?.getBoundingClientRect();
      const gantt = document.querySelector(".planning-gantt-shell")?.getBoundingClientRect();
      const ganttTheme = document.querySelector(".planning-gantt-shell .planning-owned-chart svg")?.getBoundingClientRect();
      const firstGanttRow = document.querySelector(".planning-gantt-shell .planning-owned-grid-row")?.getBoundingClientRect();
      const firstGanttChart = document.querySelector(".planning-gantt-shell .planning-owned-chart")?.getBoundingClientRect();
      const inspector = document.querySelector(".workflow-secondary-region")?.getBoundingClientRect();
      return {
        shellWidth: shell?.width || 0,
        workflowHeaderVisible: Boolean(workflowHeader),
        toolbarHeight: toolbar?.height || 0,
        ganttTop: gantt?.top || 0,
        ganttWidth: gantt?.width || 0,
        ganttHeight: gantt?.height || 0,
        ganttThemeHeight: ganttTheme?.height || 0,
        firstGanttRowHeight: firstGanttRow?.height || 0,
        firstGanttChartHeight: firstGanttChart?.height || 0,
        overlap: Boolean(gantt && inspector && !(gantt.right <= inspector.left || inspector.right <= gantt.left || gantt.bottom <= inspector.top || inspector.bottom <= gantt.top)),
      };
    });
    expect(layout.shellWidth).toBeGreaterThan(300);
    expect(layout.workflowHeaderVisible).toBe(false);
    if (viewport.width > 980) {
      expect(layout.toolbarHeight).toBeLessThan(290);
      expect(layout.ganttTop).toBeLessThan(320);
    }
    expect(layout.ganttWidth).toBeGreaterThan(280);
    expect(layout.ganttHeight).toBeGreaterThan(360);
    expect(layout.ganttThemeHeight).toBeGreaterThan(220);
    expect(layout.firstGanttRowHeight).toBeGreaterThanOrEqual(48);
    expect(layout.firstGanttChartHeight).toBeGreaterThan(220);
    if (viewport.width > 980) expect(layout.overlap).toBe(false);

    const screenshot = await page.screenshot();
    expect(screenshot.length).toBeGreaterThan(20_000);
  }

  await page.getByRole("button", { name: /Open account menu/ }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "dark");
  await expect.poll(() => consoleErrors).toEqual([]);
});

async function openPlanning(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Planning" }).click();
  await expect(page.getByRole("region", { name: "Planning", exact: true })).toBeVisible();
}

async function installMockApi(page: Page, dependencyPayloads: unknown[], taskPayloads: unknown[], taskUpdatePayloads: unknown[]) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("uok_token", "proof-token");
    window.localStorage.setItem("uok_user", JSON.stringify({
      username: "admin",
      display_name: "UOK Admin",
      email: "admin@example.test",
      role: "platform_admin",
    }));
  });

  await page.route("/api/dashboard", (route) => route.fulfill({ json: { counts: { planning_projects: 1, planning_tasks: 2 } } }));
  await page.route("/api/baseline-evidence", (route) => route.fulfill({ json: { ok: true, checks: { planning_ui_proof: true } } }));
  await page.route("/api/architecture/alignment", (route) => route.fulfill({ json: { ok: true, checks: { module_neutral_baseline: true } } }));
  await page.route("/api/modules/catalog", (route) => route.fulfill({ json: { modules: moduleCatalog() } }));
  await page.route("/api/planning/projects", (route) => route.fulfill({ json: [sampleProject] }));
  await page.route(`/api/planning/projects/${sampleProject.id}/schedule`, (route) => route.fulfill({ json: sampleSchedule }));
  await page.route(`/api/planning/projects/${sampleProject.id}/tasks`, async (route) => {
    taskPayloads.push(route.request().postDataJSON());
    await route.fulfill({ json: { status: "validated" } });
  });
  await page.route("/api/planning/tasks/**", async (route) => {
    taskUpdatePayloads.push(route.request().postDataJSON());
    await route.fulfill({ json: { status: "validated" } });
  });
  await page.route(`/api/planning/projects/${sampleProject.id}/dependencies`, async (route) => {
    dependencyPayloads.push(route.request().postDataJSON());
    await route.fulfill({ json: { status: "validated" } });
  });
  await page.route("/api/contacts**", (route) => route.fulfill({ json: [] }));
}

function moduleCatalog() {
  const base = { version: "3.1.0-alpha.3", installable: true, uninstallable: true, updatable: true, maintainable: true, required: false, dependencies: [], dependents: [] };
  return {
    "apps.manager": { ...base, name: "apps.manager", status: "installed", kind: "control_module", required: true, uninstallable: false },
    "agents.core": { ...base, name: "agents.core", status: "available", kind: "capability_module" },
    "contacts.core": { ...base, name: "contacts.core", status: "available", kind: "capability_module" },
    "planning.core": { ...base, name: "planning.core", status: "installed", kind: "capability_module" },
  };
}

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
  validation: { ok: true, violations: [] },
  tasks: [
    {
      id: "task-1",
      project_id: sampleProject.id,
      parent_task_id: null,
      title: "Define schedule scope",
      task_type: "task",
      status: "planned",
      start: "2026-08-01",
      end: "2026-08-03",
      duration_days: 3,
      progress: 40,
      sort_order: 1,
      critical: true,
    },
    {
      id: "task-2",
      project_id: sampleProject.id,
      parent_task_id: null,
      title: "Build integrated Gantt",
      task_type: "task",
      status: "planned",
      start: "2026-08-04",
      end: "2026-08-10",
      duration_days: 7,
      progress: 0,
      sort_order: 2,
      critical: true,
    },
  ],
  dependencies: [
    {
      id: "dep-1",
      project_id: sampleProject.id,
      predecessor_task_id: "task-1",
      successor_task_id: "task-2",
      dependency_type: "finish_to_start",
      lag_days: 0,
    },
  ],
};

test("UOK proof gate covers planning Gantt usability and visual stability", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await installMockApi(page);

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 900, height: 760 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await openPlanning(page);

    await expect(page.getByRole("heading", { name: "Project schedule" })).toBeVisible();
    await expect(page.getByLabel("Planning Gantt chart")).toBeVisible();
    const taskTable = page.getByRole("table", { name: "Planning tasks" });
    await expect(taskTable).toBeVisible();
    await expect(taskTable.getByRole("row", { name: /Build integrated Gantt/ })).toBeVisible();

    const layout = await page.evaluate(() => {
      const shell = document.querySelector(".shell")?.getBoundingClientRect();
      const gantt = document.querySelector(".planning-gantt-shell")?.getBoundingClientRect();
      const status = document.querySelector(".planning-status")?.getBoundingClientRect();
      return {
        shellWidth: shell?.width || 0,
        ganttWidth: gantt?.width || 0,
        ganttHeight: gantt?.height || 0,
        overlap: Boolean(gantt && status && !(gantt.right <= status.left || status.right <= gantt.left || gantt.bottom <= status.top || status.bottom <= gantt.top)),
      };
    });
    expect(layout.shellWidth).toBeGreaterThan(300);
    expect(layout.ganttWidth).toBeGreaterThan(280);
    expect(layout.ganttHeight).toBeGreaterThan(360);
    if (viewport.width > 980) expect(layout.overlap).toBe(false);

    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();
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

async function installMockApi(page: Page) {
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
  await page.route("/api/contacts**", (route) => route.fulfill({ json: [] }));
}

function moduleCatalog() {
  const base = {
    version: "3.1.0-alpha.3",
    installable: true,
    uninstallable: true,
    updatable: true,
    maintainable: true,
    required: false,
    dependencies: [],
    dependents: [],
  };
  return {
    "apps.manager": { ...base, name: "apps.manager", status: "installed", kind: "control_module", required: true, uninstallable: false },
    "agents.core": { ...base, name: "agents.core", status: "available", kind: "capability_module" },
    "contacts.core": { ...base, name: "contacts.core", status: "available", kind: "capability_module" },
    "planning.core": { ...base, name: "planning.core", status: "installed", kind: "capability_module" },
  };
}

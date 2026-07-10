import { expect, test, type Page } from "@playwright/test";

const project = { id: "scale-project", name: "500 task scale proof", status: "active", start: "2027-01-04", end: "2028-12-31", timezone: "UTC", revision: 1 };
const capabilities = { read: true, edit: true, baseline_create: true, level: true, link: true, gate_approve: true, admin: true, analyze: true, analysis_approve: true, review_only: false };
const tasks = Array.from({ length: 500 }, (_, index) => ({
  id: `scale-task-${index + 1}`,
  project_id: project.id,
  version: 1,
  parent_task_id: null,
  wbs: String(index + 1),
  title: `Scale task ${index + 1}`,
  task_type: "task",
  status: "planned",
  start: "2027-01-04",
  end: "2027-01-04",
  duration_days: 1,
  progress: index % 100,
  sort_order: index,
  critical: index < 20,
  total_slack_days: index < 20 ? 0 : 5,
  readiness: { ready: true, required_count: 0, blocking_count: 0, blocking_requirement_ids: [] },
}));
const dependencyPairs = [
  ...Array.from({ length: 499 }, (_, index) => [index, index + 1]),
  ...Array.from({ length: 301 }, (_, index) => [index, index + 2]),
];
const schedule = {
  project,
  capabilities,
  tasks,
  dependencies: dependencyPairs.map(([source, target], index) => ({
    id: `scale-dependency-${index + 1}`,
    project_id: project.id,
    predecessor_task_id: tasks[source].id,
    successor_task_id: tasks[target].id,
    dependency_type: "start_to_start",
    lag_days: 0,
  })),
  calendar: { name: "Standard", working_days: [1, 2, 3, 4, 5], holidays: [] },
  availability: { source_module: "calendar.core", scope: "project", status: "ready", from: project.start, to: project.end, warnings: [], busy: [], events: [] },
  resources: [], assignments: [], links: [], participants: [], requirements: [],
  readiness: { ready: true, required_count: 0, blocking_count: 0, blocking_requirement_ids: [], task_blocker_count: 0 },
  baselines: [], validation: { ok: true, violations: [], warnings: [] },
};

test("500-row Gantt meets the initial interaction and long-task budgets", async ({ page }, testInfo) => {
  await installScaleApi(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const started = await page.evaluate(() => performance.now());
  await page.getByRole("button", { name: "Planning" }).click();
  await expect(page.getByLabel("Planning Gantt chart")).toBeVisible();
  await expect(page.locator(".planning-owned-grid-row").first()).toBeVisible();
  const interactiveMs = await page.evaluate((value) => performance.now() - value, started);
  expect(interactiveMs).toBeLessThan(2_000);

  await page.evaluate(() => { (window as Window & { uokLongTasks?: number[] }).uokLongTasks = []; });
  const grid = page.locator(".planning-owned-grid-body");
  await grid.evaluate((node) => { node.scrollTop = node.scrollHeight; node.dispatchEvent(new Event("scroll")); });
  await page.waitForTimeout(250);
  const renderedRows = await page.locator(".planning-owned-grid-row").count();
  const renderedTasks = await page.locator(".planning-owned-task").count();
  const longTasks = await page.evaluate(() => (window as Window & { uokLongTasks?: number[] }).uokLongTasks || []);
  const evidence = { interactive_ms: Number(interactiveMs.toFixed(2)), rendered_grid_rows: renderedRows, rendered_timeline_tasks: renderedTasks, max_long_task_ms: Math.max(0, ...longTasks) };
  await testInfo.attach("planning-500-row-browser-budget.json", { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
  console.log(`PLANNING_SCALE_EVIDENCE ${JSON.stringify(evidence)}`);
  expect(evidence.rendered_grid_rows).toBeGreaterThan(0);
  expect(evidence.rendered_grid_rows).toBeLessThan(100);
  expect(evidence.rendered_timeline_tasks).toBe(evidence.rendered_grid_rows);
  expect(evidence.max_long_task_ms).toBeLessThan(200);
});

async function installScaleApi(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("uok_token", "scale-proof-token");
    window.localStorage.setItem("uok_user", JSON.stringify({ username: "admin", display_name: "UOK Admin", email: "admin@example.test", role: "platform_admin" }));
    (window as Window & { uokLongTasks?: number[] }).uokLongTasks = [];
    new PerformanceObserver((list) => {
      const target = window as Window & { uokLongTasks?: number[] };
      target.uokLongTasks?.push(...list.getEntries().map((entry) => entry.duration));
    }).observe({ type: "longtask", buffered: true });
  });
  const base = { version: "3.1.0-alpha.3", installable: true, uninstallable: true, updatable: true, maintainable: true, required: false, dependencies: [], dependents: [] };
  const modules = {
    "apps.manager": { ...base, name: "apps.manager", status: "installed", kind: "control_module", required: true, uninstallable: false },
    "communications.core": { ...base, name: "communications.core", status: "installed", kind: "capability_module" },
    "planning.core": { ...base, name: "planning.core", status: "installed", kind: "capability_module" },
  };
  await page.route("/api/dashboard", (route) => route.fulfill({ json: { counts: { planning_projects: 1, planning_tasks: 500 } } }));
  await page.route("/api/baseline-evidence", (route) => route.fulfill({ json: { ok: true, checks: { planning_ui_proof: true } } }));
  await page.route("/api/architecture/alignment", (route) => route.fulfill({ json: { ok: true, checks: { module_neutral_baseline: true } } }));
  await page.route("/api/modules/catalog", (route) => route.fulfill({ json: { modules } }));
  await page.route("/api/planning/capabilities", (route) => route.fulfill({ json: capabilities }));
  await page.route("/api/planning/projects", (route) => route.fulfill({ json: [project] }));
  await page.route(`/api/planning/projects/${project.id}/schedule`, (route) => route.fulfill({ json: schedule, headers: { ETag: `"planning-r1-sha256-${"a".repeat(64)}"` } }));
}

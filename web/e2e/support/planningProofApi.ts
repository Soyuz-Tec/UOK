import { expect, type Page } from "@playwright/test";

import { sampleProject, sampleSchedule } from "./planningProofFixtures";

export type PlanningProofContext = {
  page: Page;
  viewport: { width: number; height: number };
  dependencyPayloads: unknown[];
  taskPayloads: unknown[];
  taskUpdatePayloads: unknown[];
  batchPayloads: unknown[];
};

const samplePortfolio = {
  total: 1, limit: 50, offset: 0, query: "", status: "",
  projects: [{
    id: sampleProject.id, name: sampleProject.name, status: "active", start: sampleProject.start, end: sampleProject.end,
    target_finish: sampleProject.target_finish, calculated_finish: sampleProject.calculated_finish,
    latest_task_finish: "2026-08-13", schedule_horizon: sampleProject.end,
    timezone: "America/New_York", revision: 1, updated_at: sampleProject.updated_at,
    metrics: { task_count: 4, completed_task_count: 0, in_progress_task_count: 0, blocked_task_count: 0, milestone_count: 1, dependency_count: 1, completion_percent: 15 },
    attention: { health: "blocked", overdue_task_count: 0, gate_blocker_count: 1, unavailable_blocking_link_count: 0, project_overdue: false, project_late: false, issue_count: 1 },
  }],
  summary: { visible_project_count: 1, total_project_count: 1, task_count: 4, completed_task_count: 0, blocked_task_count: 0, overdue_task_count: 0, gate_blocker_count: 1, at_risk_project_count: 1, status_counts: { active: 1 }, range_start: sampleProject.start, range_end: sampleProject.end },
  diagnostics: { strategy: "bounded_aggregate_v1", query_count: 6, elapsed_ms: 8.2 },
};

export async function expectPlanningProjectContext(page: Page, projectId: string, projectName: string, status: string) {
  const planningCommands = page.getByRole("region", { name: "Planning commands", exact: true });
  const projectSummary = planningCommands.getByRole("region", { name: "Project summary", exact: true });
  const projectPicker = projectSummary.getByRole("combobox", { name: "Project", exact: true });
  await expect(projectSummary).toBeVisible();
  await expect(projectPicker).toHaveValue(projectId);
  await expect(projectPicker.locator("option:checked")).toHaveText(projectName);
  await expect(projectSummary.getByText(status, { exact: true })).toBeVisible();
  return projectSummary;
}

export async function openPlanningInspector(page: Page) {
  const planningControlsTrigger = page.getByLabel("Open planning controls");
  await planningControlsTrigger.click();
  const planningControls = page.getByRole("dialog", { name: "Planning controls", exact: true });
  await expect(planningControls).toBeVisible();
  await planningControls.getByRole("button", { name: "Show inspector", exact: true }).click();
  await expect(planningControls).toBeHidden();
  const inspectorDialog = page.getByRole("dialog", { name: "Planning inspector", exact: true });
  await expect(inspectorDialog).toBeVisible();
  return { inspectorDialog, planningControlsTrigger };
}

export async function openPlanning(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Planning" }).click();
  await expect(page.getByRole("region", { name: "Planning", exact: true })).toBeVisible();
}

export async function installMockApi(
  page: Page,
  dependencyPayloads: unknown[],
  taskPayloads: unknown[],
  taskUpdatePayloads: unknown[],
  batchPayloads: unknown[],
  schedule = sampleSchedule,
) {
  const planningEtag = `"planning-r1-sha256-${"a".repeat(64)}"`;
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
  await page.route("/api/planning/capabilities", (route) => route.fulfill({ json: schedule.capabilities }));
  await page.route("/api/planning/portfolio**", (route) => route.fulfill({ json: samplePortfolio }));
  await page.route("/api/planning/projects", (route) => route.fulfill({ json: [sampleProject] }));
  await page.route(`/api/planning/projects/${sampleProject.id}/schedule`, (route) => route.fulfill({ json: schedule, headers: { ETag: planningEtag } }));
  await page.route(`/api/planning/projects/${sampleProject.id}/tasks`, async (route) => {
    taskPayloads.push(route.request().postDataJSON());
    await route.fulfill({ json: { status: "validated" }, headers: { ETag: planningEtag } });
  });
  await page.route(`/api/planning/projects/${sampleProject.id}/mutations:batch`, async (route) => {
    const payload = route.request().postDataJSON();
    batchPayloads.push(payload);
    await route.fulfill({
      json: { correlation_id: "proof-batch", previous_revision: 1, revision: 2, operation_results: [], schedule },
      headers: { ETag: planningEtag },
    });
  });
  await page.route("/api/planning/tasks/**", async (route) => {
    taskUpdatePayloads.push(route.request().postDataJSON());
    await route.fulfill({ json: { status: "validated", correlation_id: "11111111-1111-4111-8111-111111111111" }, headers: { ETag: planningEtag } });
  });
  await page.route(`/api/planning/projects/${sampleProject.id}/dependencies`, async (route) => {
    dependencyPayloads.push(route.request().postDataJSON());
    await route.fulfill({ json: { status: "validated" }, headers: { ETag: planningEtag } });
  });
  await page.route("/api/contacts**", (route) => route.fulfill({ json: [{ id: "party-proof", display_name: "Pilot approver", status: "active" }] }));
  const proofThread = {
    id: "thread-proof", title: "Pilot K Connect room", status: "open", context_type: "planning.task", context_id: "task-1",
    restore_status: null, revision: 1, etag: '"communication-thread:thread-proof:v1"', can_delete: true, can_restore: false,
    created_by_user_id: "user-proof", created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z",
  };
  await page.route("/api/communications/capabilities", (route) => route.fulfill({ json: { read: true, create: true, delete: true, restore: true } }));
  await page.route("/api/communications/threads**", (route) => {
    const pathname = new URL(route.request().url()).pathname;
    return route.fulfill({ json: pathname === "/api/communications/threads/thread-proof" ? proofThread : [proofThread] });
  });
}

function moduleCatalog() {
  const base = {
    version: "3.1.0-alpha.3", maturity: "runtime_proven", installable: true,
    uninstallable: true, updatable: true, maintainable: true, required: false,
    recorded_status: null, reconciliation_required: false,
    lifecycle: ["available", "installed", "disabled", "upgraded", "uninstalled"],
    lifecycle_state_declared: true, dependencies: [], dependents: [],
  };
  return {
    "apps.manager": { ...base, name: "apps.manager", status: "installed", recorded_status: "installed", kind: "control_module", required: true, uninstallable: false, lifecycle: ["installed", "upgraded"] },
    "agents.core": { ...base, name: "agents.core", status: "planned", maturity: "planned", kind: "capability_module", installable: false, uninstallable: false, updatable: false, maintainable: false, lifecycle: ["planned"] },
    "contacts.core": { ...base, name: "contacts.core", status: "available", kind: "capability_module" },
    "communications.core": { ...base, name: "communications.core", status: "installed", recorded_status: "installed", kind: "capability_module" },
    "planning.core": { ...base, name: "planning.core", status: "installed", recorded_status: "installed", kind: "capability_module" },
  };
}

export function proofEtag(revision: number) {
  return `"planning-r${revision}-sha256-${String(revision).padStart(64, "0")}"`;
}
